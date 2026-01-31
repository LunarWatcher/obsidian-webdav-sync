"""
This file contains tests that ensure that the config/settings screen works as 
intended.
"""
from selenium.webdriver import Chrome
from selenium.webdriver.common.by import By
from tests.utils import click_settings_nav, find_setting_input, get_settings_data, open_settings

from functools import reduce
from operator import getitem
from dataclasses import dataclass

@dataclass
class SettingsInputter:
    settings_key: list[str]

def _open_settings(obsidian: Chrome):
    open_settings(obsidian)
    click_settings_nav(obsidian)

def test_fields_stored_correctly(
    obsidian: Chrome
):
    """
    Mainly checks for minor errors with input saving. If this fails, there's
    likely a typo in the settings dialog
    """

    def resolve_keys(settings, keys):
        # The fact this is a thing is ridiculous.
        # I love it
        return reduce(
            getitem,
            keys,
            settings
        )

    _open_settings(obsidian)

    # Used for testing all the single-field/toggle/button/whatever things
    # For complex tests that go outside the bounds of this struct:
    # * If possible, add another  field so the test can be used anyway
    # * If the test is too complex, create a separate test. Leave a comment
    #   saying that it has been tested in another test
    fields: dict[str, SettingsInputter] = {
        # Root key: server_conf {{{
        "WebDAV URL": SettingsInputter(
            ["server_conf", "url"]
        ),
        "WebDAV username": SettingsInputter(
            ["server_conf", "username"]
        ),
        # }}}
        # Root key: sync {{{
        "Full vault sync": SettingsInputter(
            ["sync", "full_vault_sync"]
        ),
        "Ignore workspace files": SettingsInputter(
            ["sync", "ignore_workspace"]
        ),
        # Subfolders: separate test
        "WebDAV share for the full vault": SettingsInputter(
            # Note: a subkey is used because the root_folder key is an object
            ["sync", "root_folder", "dest"]
        ),
        # }}}
    }
    for field_name, settings_inputter in fields.items():
        input_field = find_setting_input(
            obsidian, field_name
        ).find_element(
            By.TAG_NAME,
            "input"
        )
        type = input_field.get_attribute("type")
        assert type is not None, \
            "Something has gone catastrophically wrong"
        if type == "checkbox":
            value_old = input_field.get_attribute("value")
            input_field.click()
            data = get_settings_data(obsidian)
            assert resolve_keys(
                data,
                settings_inputter.settings_key
            ) == (not value_old), \
                "Failed to verify {}".format(field_name)

def test_folder_maps_stored_correctly(obsidian: Chrome):
    _open_settings(obsidian)

    input_root = find_setting_input(
        obsidian, "Folder mapping"
    )
    inputs = input_root.find_elements(
        By.CSS_SELECTOR,
       'input[type="text"]'
    )
    assert len(inputs) == 2
    btn = input_root.find_element(By.TAG_NAME, "button")
    assert btn is not None

    webdav_inp = inputs[0]
    vault_path = inputs[1]

    # Verify that the webdav input is, in fact, the webdav input
    # Not sure if this is necessary, but it'll at least avoid more obscure test
    # failures if the fields are changed
    assert webdav_inp.get_attribute("placeholder") == "/webdav/share/path"
    # TODO: finish test
