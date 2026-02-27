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
    get_notice_messages, get_ribbon_button, inject_settings, open_settings, default_settings
from time import sleep

def inject_settings_with_ignore_config_folder(
    obsidian: Chrome,
    ignore: bool
):
    settings = default_settings()
    settings["sync"]["ignore_config_folder"] = ignore
    inject_settings(obsidian, settings_object=settings)

def modify_vault(vault: str):
    with open(os.path.join(vault, ".obsidian", "test.txt"), "w") as f:
        f.write("owo")

def test_baseline_sync_config_folder_changes(
    obsidian: Chrome,
    vault: str,
    screenshotter,
    copyparty: Copyparty
):
    """
    Tests that the .obsidian folder is synced as expected when its sync is
    enabled.
    """
    inject_settings_with_ignore_config_folder(obsidian, False)
    modify_vault(vault)
    autoupload(obsidian, screenshotter, False)

    assert os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            ".obsidian",
            "test.txt"
        )
    )
    assert os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            ".obsidian"
        )
    )

def test_sync_config_folder_changes_on_ignored_on_push(
    obsidian: Chrome,
    vault: str,
    screenshotter,
    copyparty: Copyparty
):
    """
    Tests that changes to the vault in .obsidian are ignored.
    """
    inject_settings_with_ignore_config_folder(obsidian, True)
    modify_vault(vault)
    autoupload(obsidian, screenshotter, False)

    assert not os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            ".obsidian",
            "test.txt"
        )
    ), "ignore_config_folder was not respected"
    assert not os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            ".obsidian"
        )
    )

def test_sync_config_folder_changes_on_ignored_on_push_with_preexisting_config_folder(
    obsidian: Chrome,
    vault: str,
    screenshotter,
    copyparty: Copyparty
):
    """
    Tests that changes to the vault in .obsidian are ignored, and that the
    .obsidian folder is not deleted when it has previously been synced.
    """
    inject_settings_with_ignore_config_folder(obsidian, False)
    autoupload(obsidian, screenshotter)
    assert os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            ".obsidian"
        )
    )

    inject_settings_with_ignore_config_folder(obsidian, True)
    modify_vault(vault)
    autoupload(obsidian, screenshotter, False)

    assert not os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            ".obsidian",
            "test.txt"
        )
    ), "ignore_config_folder was not respected"
    assert os.path.exists(
        os.path.join(
            copyparty.root_vault_path,
            ".obsidian"
        )
    )
