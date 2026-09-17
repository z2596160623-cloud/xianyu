import logging

from xianyu_crawler import launcher


def test_setup_logging_without_console(tmp_path, monkeypatch):
    root = logging.getLogger()
    original = list(root.handlers)
    for handler in original:
        root.removeHandler(handler)
    monkeypatch.setattr(launcher.sys, "stderr", None)
    try:
        launcher._setup_logging(tmp_path)
        assert len(root.handlers) == 1
        assert isinstance(root.handlers[0], launcher.RotatingFileHandler)
    finally:
        for handler in list(root.handlers):
            handler.close()
            root.removeHandler(handler)
        for handler in original:
            root.addHandler(handler)
