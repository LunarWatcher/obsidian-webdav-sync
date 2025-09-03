import json
import os
from pytest import fail, raises
import pytest
from selenium.webdriver import Chrome
from selenium.webdriver.common.by import By
# The amount of arbitrary shit just part of Python's stdlib is amazing
import filecmp

from tests.constants import DOWNLOAD_BUTTON_ID, UPLOAD_BUTTON_ID
from tests.copyparty import Copyparty
from tests.utils import assert_sync_modal_shown, click_settings_nav, get_notice_message, get_ribbon_button, inject_settings, open_settings
from time import sleep


def test_server_connection(obsidian: Chrome, copyparty, screenshotter):
    inject_settings(obsidian)

    open_settings(obsidian)
    click_settings_nav(obsidian)
    screenshotter("Settings opened")

    elem = obsidian.find_element(
        By.ID,
        "webdav-settings-test-connection"
    )
    elem.click()
    screenshotter("After button click")

    notice_content = get_notice_message(
        obsidian
    )
    assert notice_content is not None
    assert "Connection succeeded. Found folder with " in notice_content, notice_content

def test_push_pull(
    obsidian: Chrome,
    vault,
    copyparty: Copyparty,
    screenshotter
):
    inject_settings(obsidian)

    try:
        ribbon = get_ribbon_button(obsidian)
        ribbon.click()
    except Exception as e:
        screenshotter("Fail-unk")
        raise e

    assert_sync_modal_shown(obsidian, screenshotter)
    screenshotter("Dialog opened")

    obsidian.find_element(
        By.ID,
        UPLOAD_BUTTON_ID
    ).click()
    sleep(0.3)
    screenshotter("After upload clicked")

    with raises(pytest.fail.Exception):
        assert_sync_modal_shown(obsidian)

    comp = filecmp.dircmp(
        vault,
        copyparty.root_vault_path
    )
    assert len(comp.diff_files) == 0, comp
    # This could be hardcoded, but hardcoding the number of files is dumb and
    # will require too regular updates to be worthwhile. We assert the number
    # of files is greater than 0, as this ensures at least one file has been
    # found, so the 0 diff is likely correct.
    assert len(comp.common_files) > 0

    # This test does not and should not test for every conceivable file, as
    # dircmp is not recursive - but this tests two (three) critical cases:
    # 1. Root-level files
    # 2. Subdirectory files
    # 3. (kinda) subdirectory creation (this is more of a canary)
    for file in comp.common_files:
        if file == "README.md":
            break
    else:
        fail("Failed to locate README.md: " + json.dumps(comp.common_files))

    for file in comp.common_dirs:
        if file.replace("\\", "/") == "subfolder":
            break
    else:
        fail("Failed to locate file from subfolder: "
             + json.dumps(comp.common_dirs)
        )

    assert os.path.exists(
        os.path.join(copyparty.subfolder_path, "Public file.md")
    )

    readmePath = os.path.join(
        vault,
        "README.md"
    )

    # Validate that the mtime is correctly updated in the remote
    # abs() because there's some drift due to rounding
    assert abs(os.stat(readmePath).st_mtime \
        - os.stat(
            os.path.join(copyparty.root_vault_path, "README.md")
        ).st_mtime) < 1

    assert os.path.exists(readmePath)
    os.remove(readmePath)
    assert not os.path.exists(readmePath)

    # Simulate a wait between the removal and the redownload
    # This means that by the time the button is clicked and the download
    # happens, if the mtime comparison is fucked, we know for sure that the
    # mtime diff will exceed 5 seconds, as the redownload is set to now
    # We're not doing this in the opposite direction because the source
    # material is copied from an archived vault that has an mtime that will
    # always far exceed 1 second
    sleep(5)
    ribbon.click()
    obsidian.find_element(
        By.ID,
        DOWNLOAD_BUTTON_ID
    ).click()
    sleep(1)

    assert os.path.exists(readmePath)

    # Validate that the mtime is correctly updated locally
    assert abs(os.stat(readmePath).st_mtime \
        - os.stat(
            os.path.join(copyparty.root_vault_path, "README.md")
        ).st_mtime) < 1
