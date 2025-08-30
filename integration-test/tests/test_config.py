from selenium.webdriver.common.by import By
from tests.utils import click_settings_nav, find_setting_input, get_settings_data, open_settings


def test_fields_stored_correctly(
    obsidian
):
    open_settings(obsidian)
    click_settings_nav(obsidian)

    input_field = find_setting_input(
obsidian, "WebDAV URL"
    ).find_element(
        By.TAG_NAME,
        "input"
    )
    input_field.send_keys(
        "https://example.com"
    )

    data = get_settings_data(obsidian)
    assert data["server_conf"] is not None
    assert data["server_conf"]["url"] == "https://example.com"
