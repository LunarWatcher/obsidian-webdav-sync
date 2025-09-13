import os
import platform
import shutil
from time import sleep
import pytest
from selenium.webdriver import Chrome
from tests.copyparty import Copyparty
from tests.utils import autodownload, autoupload, close_notices, close_sync_modal, get_notice_messages, inject_settings

@pytest.mark.skipif(
    platform.system() == "Windows",
    reason="Because this test deletes the .obsidian folder, including the plugin, windows cannot run the test. The "
        "second the plugin is gone, obsidian on Windows ceases to know how the plugin works, because reasons. "
        "The general functionality is tested by test_push_content_wipe_blocked instead, which checks the same thing "
        "minus deleting the .obsidian folder."
)
def test_push_wipe_blocked(
    obsidian: Chrome,
    vault,
    copyparty,
    screenshotter,
    preloaded_vault: None
):
    inject_settings(obsidian)

    shutil.rmtree(
        vault
    )
    # shutil nukes the root, which will likely cause other exotic errors. These are UB, so they're not tested, and we
    # need to recreate the directory to avoid them
    os.makedirs(vault)

    if platform.system() == "Windows":
        # required for windows. Copyparty needs time to recover after the deletion, because fuck windows
        sleep(2)

    autoupload(obsidian, screenshotter, True)
    sleep(1)
    notices = get_notice_messages(obsidian)
    assert len(notices) == 1
    assert "Action blocked" in notices[0], notices[0]

    close_notices(obsidian)
    close_sync_modal(obsidian)

    # Downloads should not be blocked
    autodownload(obsidian, screenshotter)
    sleep(1)
    notices = get_notice_messages(obsidian)
    assert len(notices) == 1, notices
    assert "Pull complete" in notices[0]

def test_pull_wipe_blocked(
    obsidian: Chrome,
    vault,
    copyparty: Copyparty,
    screenshotter,
    preloaded_vault: None
):
    inject_settings(obsidian)

    shutil.rmtree(
        copyparty.root_vault_path
    )
    # shutil nukes the root, which will likely cause other exotic errors. These are UB, so they're not tested, and we
    # need to recreate the directory to avoid them
    os.makedirs(
        copyparty.root_vault_path
    )

    autodownload(obsidian, screenshotter, True)
    sleep(1)
    notices = get_notice_messages(obsidian)
    assert len(notices) == 1
    assert "Action blocked" in notices[0], notices[0]

    close_notices(obsidian)
    close_sync_modal(obsidian)

    # Uploads should not be blocked
    autoupload(obsidian, screenshotter)
    sleep(1)
    notices = get_notice_messages(obsidian)
    assert len(notices) == 1, notices
    assert "Push complete" in notices[0]
