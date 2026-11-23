#!/usr/bin/env python3
"""User-invoked local Chrome profile CLI; no cookie reads, server or remote commands."""

import argparse, json, os, re, shutil, subprocess, sys
from pathlib import Path
from datetime import datetime, timezone

BASE = (
    Path(
        os.environ.get(
            "REDNOTE_PROFILE_ROOT", Path.home() / ".rednote-studio" / "profiles"
        )
    )
    .expanduser()
    .absolute()
)
OFFICIAL = "https://creator.xiaohongshu.com/"


def validate_id(value):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,59}", value):
        raise ValueError("引用 ID 仅允许字母、数字、下划线或连字符，最多 60 字符")
    return value


def safe_root():
    if BASE.is_symlink() or BASE.resolve() != BASE:
        raise ValueError("Profile 根目录及父路径不能包含符号链接")
    if BASE in [Path("/"), Path.home(), Path.home() / "Documents"]:
        raise ValueError("Profile 根目录必须是专用子目录")
    BASE.mkdir(parents=True, exist_ok=True, mode=0o700)
    marker = BASE / ".rednote-managed"
    if not marker.exists():
        if any(BASE.iterdir()):
            raise ValueError("拒绝接管已有内容的非托管目录")
        marker.write_text("rednote-profile-manager-v1\n")
        marker.chmod(0o600)
    if marker.read_text().strip() != "rednote-profile-manager-v1":
        raise ValueError("根目录标记无效")
    return BASE


def profile_path(ref):
    root = safe_root()
    path = root / validate_id(ref)
    if path.is_symlink() or path.resolve().parent != root.resolve():
        raise ValueError("非法目录或符号链接")
    return path


def confirm(message, exact):
    print(message)
    if input(f"请输入 {exact} 确认：").strip() != exact:
        raise ValueError("已取消，没有修改目录")


def chrome():
    candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        str(
            Path(os.environ.get("PROGRAMFILES", "C:/Program Files"))
            / "Google/Chrome/Application/chrome.exe"
        ),
    ]
    for c in candidates:
        if c and Path(c).is_file():
            return c
    raise ValueError("未找到 Chrome / Chromium，请先安装浏览器")


def load(ref):
    path = profile_path(ref)
    meta = path / "rednote-profile.json"
    if not meta.is_file():
        raise ValueError("环境未创建，请先执行 create")
    data = json.loads(meta.read_text())
    if data.get("id") != ref:
        raise ValueError("托管环境标记不匹配")
    return path, data


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list")
    for name in ["create", "open", "status", "delete"]:
        p = sub.add_parser(name)
        p.add_argument("ref")
    args = parser.parse_args(argv)
    try:
        if args.command == "list":
            root = safe_root()
            items = []
            for p in root.iterdir():
                if (
                    p.is_dir()
                    and not p.is_symlink()
                    and (p / "rednote-profile.json").is_file()
                ):
                    items.append(
                        {"id": p.name, "login_status": "未检测，需在浏览器中人工检查"}
                    )
            print(json.dumps(items, ensure_ascii=False, indent=2))
            return 0
        ref = validate_id(args.ref)
        path = profile_path(ref)
        if args.command == "create":
            if path.exists():
                raise ValueError("目录已存在，未覆盖")
            confirm(f"创建独立 Chrome Profile：{path}。登录信息只留在本机。", ref)
            path.mkdir(mode=0o700)
            (path / "rednote-profile.json").write_text(
                json.dumps(
                    {"id": ref, "created_at": datetime.now(timezone.utc).isoformat()}
                )
            )
            print("环境已创建，可执行 open 手动登录")
        elif args.command == "open":
            path, _ = load(ref)
            exe = chrome()
            subprocess.Popen(
                [
                    exe,
                    "--user-data-dir=" + str(path),
                    "--no-first-run",
                    "--new-window",
                    OFFICIAL,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            print("已发起可见浏览器启动请求；请本人登录并核对账号。登录状态未检测。")
        elif args.command == "status":
            path, data = load(ref)
            print(
                json.dumps(
                    {
                        **data,
                        "local_directory_exists": True,
                        "login_status": "未检测，需人工检查",
                        "browser_lock_present": (path / "SingletonLock").exists()
                        or (path / "SingletonLock").is_symlink(),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
        elif args.command == "delete":
            path, _ = load(ref)
            if (path / "SingletonLock").exists() or (
                path / "SingletonLock"
            ).is_symlink():
                raise ValueError("存在浏览器锁，请关闭此环境后再删除")
            confirm(f"删除 {ref} 将永久移除这个独立环境中的浏览器数据。", ref)
            confirm(f"第二次确认，仅删除：{path}", f"DELETE {ref}")
            checked, _ = load(ref)
            if checked != path or path.is_symlink():
                raise ValueError("路径发生变化，拒绝删除")
            shutil.rmtree(path)
            print("本地 Profile 已删除；工作台中的引用请另行更新")
        return 0
    except (ValueError, EOFError, OSError, json.JSONDecodeError) as e:
        print("操作未完成：" + str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
