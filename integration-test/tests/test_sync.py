import json
import os
import shutil
from pytest import fail
from selenium.webdriver import Chrome
from selenium.webdriver.common.by import By
# The amount of arbitrary shit just part of Python's stdlib is amazing
import filecmp

from tests.copyparty import Copyparty
from tests.utils import autodownload, autoupload, click_settings_nav, \
    get_notice_messages, get_ribbon_button, inject_settings, open_settings
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

    notices = get_notice_messages(
        obsidian
    )
    assert len(notices) == 1
    assert "Connection succeeded. Found folder with " in notices[0], \
        notices[0]

def test_push_pull(
    obsidian: Chrome,
    vault,
    copyparty: Copyparty,
    screenshotter
):
    inject_settings(obsidian)
    autoupload(obsidian, screenshotter)
    notices = get_notice_messages(obsidian)
    assert len(notices) == 1, notices
    assert "Push complete" in notices[0]

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
    autodownload(obsidian, screenshotter)
    sleep(1)
    notices = get_notice_messages(obsidian)
    assert len(notices) == 1, notices
    assert "Pull complete" in notices[0]

    assert os.path.exists(readmePath)

    # Validate that the mtime is correctly updated locally
    assert abs(os.stat(readmePath).st_mtime \
        - os.stat(
            os.path.join(copyparty.root_vault_path, "README.md")
        ).st_mtime) < 1

def test_obsidian_folder_logic(
    obsidian: Chrome,
    vault: str
):
    # TODO: this test is proof enough that Map()s need to be dropped. They're
    # absolutely horrid to work with, and do not serialise properly
    data = obsidian.execute_async_script("""
    let plugin = app.plugins.plugins["webdav-sync"];
    let fileInterface = plugin._getFileInterface();
    let content = await fileInterface.getVaultFiles();
    arguments[arguments.length - 1](JSON.stringify({
        files: Object.fromEntries(content.files),
        folderPaths: content.folderPaths
    }))
    """)
    assert data is not None
    j = json.loads(data)
    assert isinstance(j, dict), data

    # 3 folders + .obsidian + .obsidian/plugins + .obsidian/plugins/<plugin id>
    assert len(j["folderPaths"]) == 6, data
    # 4: markdown files
    # 8: 4x default .obsidian files, 3x plugin files, 1x .gitinclude
    assert len(j["files"]) == 4 + 8, data

def test_directory_removal_on_push(
    obsidian: Chrome,
    vault: str,
    copyparty: Copyparty,
    screenshotter,
    preloaded_vault: None
):
    inject_settings(obsidian)

    assert os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            "private_subfolder",
            "mrrp meow.md"
        )
    )
    assert os.path.exists(
        copyparty.private_subfolder
    )

    shutil.rmtree(
        os.path.join(
            vault,
            "private_subfolder"
        )
    )
    autoupload(obsidian, screenshotter)
    notices = get_notice_messages(obsidian)
    assert len(notices) == 1, notices
    assert "1 stale folders were removed (0 errors)" in notices[0], notices[0]

    assert not os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            "private_subfolder",
            "mrrp meow.md"
        )
    ), "File deletion is borked"
    assert not os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            "private_subfolder"
        )
    ), "Folder deletion is borked"
    assert os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            "canary"
        )
    ), "Folder deletion deleted too much"
    assert os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            "canary",
            "awooken.md"
        )
    ), "Folder deletion deleted too much"


def test_directory_removal_on_pull(
    obsidian: Chrome,
    vault: str,
    copyparty: Copyparty,
    screenshotter,
    preloaded_vault: None
):
    inject_settings(obsidian)

    assert os.path.exists(
        os.path.join(
            copyparty.private_subfolder,
            "mrrp meow.md"
        )
    )
    assert os.path.exists(
        copyparty.private_subfolder
    )

    shutil.rmtree(
        copyparty.private_subfolder
    )
    autodownload(obsidian, screenshotter)
    notices = get_notice_messages(obsidian)
    assert len(notices) == 1, notices
    assert "1 stale folders were removed (0 errors)" in notices[0], notices[0]

    assert not os.path.exists(
        os.path.join(
            vault,
            "private_subfolder",
            "mrrp meow.md"
        )
    ), "File deletion is borked"
    assert not os.path.exists(
        os.path.join(
            vault,
            "private_subfolder"
        )
    ), "Folder deletion is borked"
    assert os.path.exists(
        os.path.join(
            vault,
            "canary"
        )
    ), "Folder deletion deleted too much"
    assert os.path.exists(
        os.path.join(
            vault,
            "canary",
            "awooken.md"
        )
    ), "Folder deletion deleted too much"


