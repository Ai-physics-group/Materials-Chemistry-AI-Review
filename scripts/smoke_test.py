"""知析台 · 全链路冒烟测试。

在临时目录中启动「本地 OpenAI 兼容桩服务 + 真实 uvicorn 服务」，走完下面这条链路：

    静态前端 → 保存接口配置 → 测试连接 → 建项目 → 上传文献 → 解析
    → 分析任务（轮询进度）→ 读取报告 → 下载三种导出 → 域名边界拦截
    → 协作任务：三名 agent 并发 → skill 循环 → 产物归档 → 打包下载

全程使用临时数据目录，结束后自动清理，不会触碰 data 目录中的真实数据，
也不会访问任何外部网络。

用法：
    .venv\\Scripts\\python.exe scripts\\smoke_test.py
或双击 scripts\\smoke-test.cmd
"""

from __future__ import annotations

import os
import pathlib
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import httpx
except ImportError:  # pragma: no cover - 仅在用错解释器时触发
    print("缺少 httpx，请使用项目虚拟环境运行：.venv\\Scripts\\python.exe scripts\\smoke_test.py")
    raise SystemExit(1)

ROOT = pathlib.Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    if ok:
        print(f"  [通过] {name}")
    else:
        print(f"  [失败] {name}" + (f" → {detail}" if detail else ""))
        failures.append(name)


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def wait_for_health(base: str, process: subprocess.Popen, timeout: float = 45.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if process.poll() is not None:
            return False
        try:
            if httpx.get(f"{base}/api/health", timeout=2).status_code == 200:
                return True
        except httpx.HTTPError:
            pass
        time.sleep(0.4)
    return False


class UploadReceiver(BaseHTTPRequestHandler):
    """冒充一个「接收上传」的对端，记录收到的原始请求。"""

    protocol_version = "HTTP/1.1"
    received: dict = {}

    def do_POST(self):  # noqa: N802 - BaseHTTPRequestHandler 接口
        length = int(self.headers.get("content-length") or 0)
        UploadReceiver.received = {
            "path": self.path,
            "content_type": self.headers.get("content-type", ""),
            "body": self.rfile.read(length),
        }
        if self.path == "/fail":
            self.send_response(500)
            raw = b'{"error":"rejected"}'
        else:
            self.send_response(200)
            raw = b'{"ok":true}'
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *_args):
        return


def _start_receiver():
    server = ThreadingHTTPServer(("127.0.0.1", 0), UploadReceiver)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_port}"


def run_checks(base: str, mock_port: str) -> None:
    with httpx.Client(base_url=base, timeout=30) as client:
        # ---------- 前端静态资源 ----------
        index = client.get("/")
        check("前端首页可访问", index.status_code == 200 and '<div id="root">' in index.text)

        script = re.search(r'/assets/[^"]+\.js', index.text)
        check("前端脚本资源可访问", bool(script) and client.get(script.group(0)).status_code == 200)

        style = re.search(r'/assets/[^"]+\.css', index.text)
        check("前端样式资源可访问", bool(style) and client.get(style.group(0)).status_code == 200)

        # ---------- 接口配置 ----------
        saved = client.put(
            "/api/settings",
            json={"base_url": f"http://127.0.0.1:{mock_port}/v1", "model": "mock-model", "api_key": "smoke-key"},
        )
        check("接口配置已保存", saved.status_code == 200, saved.text[:200])

        settings = client.get("/api/settings").json()
        check(
            "密钥只上报是否已配置，不回显原文",
            settings.get("has_api_key") is True and "api_key" not in settings and settings.get("model") == "mock-model",
        )
        check("连接测试通过", client.post("/api/settings/test").json().get("ok") is True)

        # ---------- 项目与文献 ----------
        project = client.post(
            "/api/projects",
            json={
                "name": "高镍正极冒烟测试",
                "research_question": "掺杂与界面状态如何影响循环寿命？",
                "study_type": "materials_ai",
                "material_system": "高镍层状正极",
                "target_journal": "Advanced Energy Materials",
            },
        ).json()
        check(
            "材料研究项目创建成功",
            bool(project.get("id")) and project.get("study_type") == "materials_ai"
            and project.get("material_system") == "高镍层状正极",
        )

        text = "这是用于冒烟测试的材料论文正文。研究采用电化学循环实验结合材料表征。" * 12
        upload = client.post(
            f"/api/projects/{project['id']}/documents",
            files=[("files", ("paper.txt", text.encode("utf-8"), "text/plain"))],
        )
        results = upload.json() if upload.status_code == 201 else []
        check(
            "文献上传并解析成功",
            bool(results) and results[0].get("status") == "ready",
            (results[0].get("error") if results else upload.text[:200]),
        )

        # ---------- 分析任务 ----------
        job = client.post(f"/api/projects/{project['id']}/analyze").json()
        check("分析任务已入队", bool(job.get("id")))

        state: dict = {}
        deadline = time.time() + 60
        while time.time() < deadline:
            state = client.get(f"/api/jobs/{job['id']}").json()
            if state.get("status") in {"completed", "failed"}:
                break
            time.sleep(0.4)

        check("分析任务完成", state.get("status") == "completed", str(state.get("error") or ""))
        check("任务进度到达 100%", state.get("progress") == 100)
        check("任务事件日志已记录", len(state.get("events") or []) >= 4)

        # ---------- 报告与导出 ----------
        report_id = state.get("report_id")
        if not report_id:
            check("报告已生成", False, "任务未返回 report_id")
            return

        markdown = client.get(f"/api/reports/{report_id}").json().get("markdown", "")
        check("报告含综合结论", "综合结论" in markdown)
        check("报告含逐篇分析与原文证据", "逐篇分析" in markdown and "电化学循环实验" in markdown)
        check("论断带出了成立条件", "适用条件：" in markdown and "25 °C" in markdown)
        check("公式以 LaTeX 保存并带符号表", "$$" in markdown and "Q_{ret}" in markdown and "mAh/g" in markdown)
        check("报告含论断聚类去重结果", "论断聚类" in markdown)
        check("质量门禁统计到公式数", "抽取公式：1 个" in markdown, markdown[:400])

        for kind in ("markdown", "json", "docx"):
            response = client.get(f"/api/reports/{report_id}/download/{kind}")
            check(f"导出 {kind}", response.status_code == 200 and len(response.content) > 0)

        # ---------- 网络边界 ----------
        blocked = client.put(
            "/api/settings",
            json={"base_url": "https://xueshufang.com/v1", "model": "x", "api_key": "y"},
        )
        check("学术坊域名被硬性拦截", blocked.status_code == 400)

        # ---------- 协作工作台 ----------
        run_collab_checks(client)


def run_collab_checks(client: httpx.Client) -> None:
    """协作工作台：三名 agent 并发 → skill 循环 → 产物归档 → 打包下载。"""
    created = client.post(
        "/api/collab/tasks",
        json={"name": "材料 AI 冒烟协作", "goal": "验证材料数据、AI 建模与论文证据产物"},
    )
    check("协作任务创建成功", created.status_code == 201, created.text[:200])
    task = created.json()
    check(
        "三名材料研究成员已就位",
        [agent["role"] for agent in task["agents"]] == ["chart", "coder", "writer"]
        and [agent["name"] for agent in task["agents"]] == ["材料数据员", "AI 建模员", "论文证据员"],
    )
    task_id = task["id"]

    data = "sample_id,ni_fraction,capacity_retention\nS1,0.80,0.88\nS2,0.82,0.86\nS3,0.85,0.83\n"
    upload = client.post(
        f"/api/collab/tasks/{task_id}/documents",
        files=[("files", ("cathode.csv", data.encode("utf-8"), "text/csv"))],
    )
    check("协作任务支持上传数据文件（CSV）", upload.status_code == 200, upload.text[:200])

    started = client.post(f"/api/collab/tasks/{task_id}/start")
    check("协作任务已启动", started.status_code == 200, started.text[:200])

    deadline = time.time() + 180
    state: dict = {}
    while time.time() < deadline:
        state = client.get(f"/api/collab/tasks/{task_id}").json()
        if state.get("status") in {"completed", "failed", "cancelled"}:
            break
        time.sleep(0.4)

    check("协作任务完成", state.get("status") == "completed", str(state.get("status")))
    check(
        "三名成员全部完成",
        {agent["role"]: agent["status"] for agent in state.get("agents", [])}
        == {"chart": "done", "coder": "done", "writer": "done"},
    )
    check("整体进度到达 100%", state.get("progress") == 100)

    artifacts = state.get("artifacts", [])
    categories = {item["filename"]: item["category"] for item in artifacts}
    check("材料数据员产出归档为「图表」", categories.get("fig_smoke.png") == "chart", str(categories))
    check(
        "AI 建模员产出归档为「代码」与「数据」",
        categories.get("compute_smoke.py") == "code" and categories.get("result_smoke.csv") == "data",
    )
    check("论文证据员产出归档为「论文」", categories.get("report.md") == "paper")
    check("队长汇总已生成", categories.get("队长汇总.md") == "paper")

    owners = {item["filename"]: item["agent_role"] for item in artifacts}
    check(
        "产物归属正确",
        owners.get("fig_smoke.png") == "chart"
        and owners.get("result_smoke.csv") == "coder"
        and owners.get("report.md") == "writer"
        and owners.get("队长汇总.md") == "captain",
        str(owners),
    )

    chart = next((item for item in artifacts if item["filename"] == "fig_smoke.png"), None)
    if chart:
        png = client.get(f"/api/collab/artifacts/{chart['id']}/download")
        check("材料数据员产物是真实 PNG", png.status_code == 200 and png.content[:8] == b"\x89PNG\r\n\x1a\n")
    else:
        check("材料数据员产物是真实 PNG", False, "未找到 fig_smoke.png")

    probe = next((item for item in artifacts if item["filename"] == "sandbox_check.txt"), None)
    if probe:
        body = client.get(f"/api/collab/artifacts/{probe['id']}/download").content.decode("utf-8").strip()
        check("执行沙箱已断网", body == "NETWORK_BLOCKED", body)
    else:
        check("执行沙箱已断网", False, "未找到 sandbox_check.txt")

    archive = client.get(f"/api/collab/tasks/{task_id}/download-all")
    check("协作产物可打包下载", archive.status_code == 200 and archive.content[:2] == b"PK")

    events = client.get(f"/api/collab/tasks/{task_id}/events").json()
    roles = {event["agent_role"] for event in events}
    check(
        "协作事件流完整",
        {"captain", "chart", "coder", "writer"} <= roles and any(event["level"] == "skill" for event in events),
    )

    # ---------- 成员对话 ----------
    directive = "请新增一个说明文件"
    assert client.get(f"/api/collab/tasks/{task_id}/agents/chart/messages").json() == []

    sent = client.post(f"/api/collab/tasks/{task_id}/agents/chart/messages", json={"message": directive})
    check("向材料数据员发起对话", sent.status_code == 202, sent.text[:160])

    deadline = time.time() + 180
    messages: list = []
    chart_status = "running"
    while time.time() < deadline:
        messages = client.get(f"/api/collab/tasks/{task_id}/agents/chart/messages").json()
        snapshot = client.get(f"/api/collab/tasks/{task_id}").json()
        chart_status = next(agent for agent in snapshot["agents"] if agent["role"] == "chart")["status"]
        if len(messages) >= 2 and chart_status != "running":
            break
        time.sleep(0.4)

    check("对话双方消息都已落库", [m["sender"] for m in messages] == ["user", "agent"], str(messages)[:200])
    check("成员给出了回复", bool(messages and messages[-1]["content"].strip()))

    state = client.get(f"/api/collab/tasks/{task_id}").json()
    artifacts = {item["filename"]: item for item in state["artifacts"]}
    check("对话真的改动了工作目录", "note.md" in artifacts, sorted(artifacts))
    check("对话产物归属到该成员", artifacts.get("note.md", {}).get("agent_role") == "chart")

    # 对话期间会改状态，结束后必须回到完成态，否则前端会一直转
    chart = next(agent for agent in state["agents"] if agent["role"] == "chart")
    check("对话结束后成员回到完成态", chart["status"] == "done", chart["status"])

    # ---------- 版本历史 ----------
    history = client.get(f"/api/collab/tasks/{task_id}/history").json()
    labels = [version["message"] for version in history]
    check("每次修改都产生了版本", len(history) >= 4, str(labels))
    check("对话修改被记成版本", any("对话修改" in text for text in labels), str(labels))
    check("版本带提交者归属", all(version["author_role"] for version in history))

    listing = client.get("/api/collab/history", params={"days": 0, "limit": 100}).json()
    check("全局历史有统计", listing["stats"]["versions"] >= 4 and listing["stats"]["tasks"] >= 1)
    check("全局历史包含本任务", any(item["task_id"] == task_id for item in listing["items"]))

    searched = client.get("/api/collab/history", params={"days": 0, "q": "note.md"}).json()
    check(
        "历史支持按文件名搜索",
        bool(searched["items"]) and all("note.md" in " ".join(f["path"] for f in item["files"]) for item in searched["items"]),
    )

    # ---------- 内联预览与就地编辑 ----------
    report = artifacts.get("report.md")
    if report:
        preview = client.get(f"/api/collab/artifacts/{report['id']}/preview").json()
        check(
            "Markdown 产物可就地预览",
            preview["kind"] == "markdown" and preview["editable"] is True and preview["content"].strip() != "",
            str(preview)[:160],
        )

        edited = client.put(
            f"/api/collab/artifacts/{report['id']}/content",
            json={"content": "# 手动改写\n\n这是冒烟测试在预览里写入的内容。\n"},
        )
        check("产物可就地编辑保存", edited.status_code == 200 and bool(edited.json().get("sha")), edited.text[:160])

        after = client.get(f"/api/collab/artifacts/{report['id']}/preview").json()
        check("编辑后的内容已生效", "冒烟测试在预览里写入的内容" in after["content"])

        manual = client.get(f"/api/collab/tasks/{task_id}/history").json()
        check(
            "手动编辑记成署名「我」的版本",
            any(v["author_role"] == "user" and v["message"].startswith("手动编辑：") for v in manual),
            str([v["message"] for v in manual])[:220],
        )
    else:
        check("Markdown 产物可就地预览", False, "未找到 report.md")

    chart_file = artifacts.get("fig_smoke.png")
    if chart_file:
        image = client.get(f"/api/collab/artifacts/{chart_file['id']}/preview").json()
        check("图片类产物按图片预览", image["kind"] == "image" and image["editable"] is False)
        check(
            "不支持在线编辑的类型被拒绝",
            client.put(
                f"/api/collab/artifacts/{chart_file['id']}/content", json={"content": "x"}
            ).status_code
            == 400,
        )
    else:
        check("图片类产物按图片预览", False, "未找到 fig_smoke.png")

    data_file = artifacts.get("result_smoke.csv")
    if data_file:
        table = client.get(f"/api/collab/artifacts/{data_file['id']}/preview").json()
        check("数据类产物按表格预览", table["kind"] == "table" and table["editable"] is True)
    check("不存在的产物返回 404", client.get("/api/collab/artifacts/nope/preview").status_code == 404)

    # ---------- 发送到网址 ----------
    receiver, receiver_url = _start_receiver()
    try:
        if report:
            sent = client.post(f"/api/collab/artifacts/{report['id']}/send", json={"url": f"{receiver_url}/upload"})
            check(
                "产物可发送到指定网址",
                sent.status_code == 200 and sent.json().get("status") == 200,
                sent.text[:160],
            )
            payload = UploadReceiver.received
            # report.md 在上一节「就地编辑」里已经被改写过，这里核对的应是改写后的内容
            marker = "冒烟测试在预览里写入的内容".encode("utf-8")
            check(
                "对端确实收到了文件内容",
                b'filename="report.md"' in payload.get("body", b"") and marker in payload.get("body", b""),
                str(payload)[:200],
            )
            check("发送用的是 multipart 上传", "multipart/form-data" in payload.get("content_type", ""))

            rejected = client.post(
                f"/api/collab/artifacts/{report['id']}/send", json={"url": f"{receiver_url}/fail"}
            )
            check("对端报错时不谎报成功", rejected.status_code == 502, rejected.text[:160])
            check(
                "非法发送地址被拒绝",
                client.post(
                    f"/api/collab/artifacts/{report['id']}/send", json={"url": "https://xueshufang.com/u"}
                ).status_code
                == 400,
            )
        else:
            check("产物可发送到指定网址", False, "未找到 report.md")
    finally:
        receiver.shutdown()

    # ---------- 回退 ----------
    target = next((version for version in history if version["message"].startswith("材料数据员：")), None)
    if target:
        restored = client.post(f"/api/collab/tasks/{task_id}/history/{target['sha']}/restore")
        check("回退接口可用", restored.status_code == 200, restored.text[:200])

        state = client.get(f"/api/collab/tasks/{task_id}").json()
        remaining = {item["filename"] for item in state["artifacts"]}
        check("回退后该版本之后的产物被移除", "note.md" not in remaining, sorted(remaining))
        check("回退保留了该版本已有的产物", "fig_smoke.png" in remaining, sorted(remaining))

        newest = client.get(f"/api/collab/tasks/{task_id}/history").json()[0]
        check("回退本身也记成一条版本", newest["message"].startswith("回退到"), newest["message"])
    else:
        check("回退接口可用", False, "没有找到可回退的版本")

    check("非法角色被拒绝", client.get(f"/api/collab/tasks/{task_id}/agents/nobody/messages").status_code == 404)
    check(
        "非法版本号被拒绝",
        client.post(f"/api/collab/tasks/{task_id}/history/zzzz/restore").status_code == 400,
    )


def main() -> int:
    if not PYTHON.exists():
        print("未找到虚拟环境，请先运行 启动网站.cmd。")
        return 1

    temp = pathlib.Path(tempfile.mkdtemp(prefix="xueshu-smoke-"))
    port_file = temp / "mock.port"
    log_path = temp / "server.log"
    log_handle = log_path.open("w", encoding="utf-8")
    mock_process: subprocess.Popen | None = None
    server_process: subprocess.Popen | None = None

    print()
    print("知析台 · 全链路冒烟测试")
    print(f"临时数据目录：{temp}")

    try:
        mock_process = subprocess.Popen(
            [
                str(PYTHON),
                str(ROOT / "backend" / "tests" / "mock_openai_server.py"),
                "--port", "0",
                "--port-file", str(port_file),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        deadline = time.time() + 20
        while not port_file.exists() and time.time() < deadline:
            time.sleep(0.2)
        if not port_file.exists():
            raise RuntimeError("桩服务未能在 20 秒内启动")
        mock_port = port_file.read_text(encoding="utf-8").strip()
        print(f"桩模型接口：http://127.0.0.1:{mock_port}/v1")

        port = free_port()
        env = {**os.environ, "XUESHU_DATA_DIR": str(temp / "data")}
        server_process = subprocess.Popen(
            [
                str(PYTHON), "-m", "uvicorn", "app.main:app",
                "--host", "127.0.0.1", "--port", str(port),
                "--app-dir", str(ROOT / "backend"),
            ],
            env=env,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
        )
        base = f"http://127.0.0.1:{port}"
        if not wait_for_health(base, server_process):
            raise RuntimeError("后端服务未能在 45 秒内就绪")
        print(f"后端服务：{base}")
        print()

        run_checks(base, mock_port)
    except Exception as exc:  # noqa: BLE001 - 冒烟测试需要报告任何异常
        print(f"  [异常] {exc}")
        failures.append("执行异常")
        log_handle.flush()
        tail = log_path.read_text(encoding="utf-8", errors="replace").strip().splitlines()[-15:]
        if tail:
            print("  ---- 后端日志 ----")
            for line in tail:
                print(f"  {line}")
    finally:
        for process in (server_process, mock_process):
            if process and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
        log_handle.close()
        shutil.rmtree(temp, ignore_errors=True)

    print()
    if not failures:
        print("冒烟测试全部通过。")
        return 0
    print(f"冒烟测试失败 {len(failures)} 项。")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
