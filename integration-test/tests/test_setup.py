"""
This file contains extremely basic tests that serve as canaries for other test
failures. The exact canaries are described in the doc comments for each
function.

A canary test in this context is a test that's not a fully standalone test, but
that can describe obscure test failures in other tests. It's stuff I as a
developer would check to debug anyway, so why not have it as explicit, separate
tests?
"""
from pytest import fail, raises
import requests
from selenium.webdriver import Chrome
from selenium.webdriver.common.by import By

from tests.copyparty import Copyparty
from tests.utils import click_settings_nav, default_settings, execute, find_setting, get_settings_data, inject_settings, open_settings

def test_buttons_visible_and_functional(obsidian: Chrome):
    """
    Canaries:
    1. Plugin load failure (Obsidian)
    2. Plugin failed to load
    3. Specific features (ribbon, settings) have stopped working
    """
    assert obsidian.find_element(By.ID, "webdav-ribbon-btn") is not None
    open_settings(obsidian)
    click_settings_nav(obsidian)

    headers = obsidian.find_elements(By.TAG_NAME, "h1")
    for header in headers:
        print("Header text: ", header.text)
        if header.text == "WebDAV sync settings":
            break
    else:
        fail("Failed to find main header")


def test_copyparty_fixture(copyparty: Copyparty):
    """
    Canary: copyparty doesn't work as intended. Immediate failures should be
    caught, but this ensures copyparty is indeed reachable where it's supposed
    to be.
    This will mainly fail on systems where copyparty isn't allowed to listen to
    :62169 (usually because of a conflict).
    """
    res = requests.get(
        copyparty.baseUrl
    )

    assert res.status_code == 200
    # "howdy stranger" is the default non-authed text for copyparty
    # Could theoretically test more, but then an entire webdriver would be
    # needed, and I don't have one readily available
    assert "howdy stranger" in res.text

def test_find_setting(obsidian):
    """
    Canaries:
    1. Changed settings structure
    2. Settings not appearing as expected (exceedingly unlikely)
    3. Developer errors in find_setting
    """
    open_settings(obsidian)
    click_settings_nav(obsidian)

    container = find_setting(obsidian, "WebDAV URL")
    assert container is not None
    assert len(
        container.find_elements(
            By.CLASS_NAME,
            "setting-item-info"
        )
    ) == 1
    assert len(
        container.find_elements(
            By.CLASS_NAME,
            "setting-item-control"
        )
    ) == 1
    assert len(
        container.find_elements(
            By.TAG_NAME,
            "input"
        )
    ) == 1
    with raises(Exception):
        # Obviously non-existent setting
        assert find_setting(obsidian, "mrrp meow owo rawr x3") is not None

    with raises(Exception):
        # Setting from Templates (tells whether or not obsidian hides or
        # removes other settings)
        assert find_setting(obsidian, "Time format") is not None

def test_execute_returns(obsidian: Chrome):
    """
    Canary: whether or not CDP has changed how it handles returns/results
    """
    result = execute(obsidian, "42")
    # For debugging
    print(result)
    assert result["result"]["value"] == 42

def test_settings_sideloading(obsidian: Chrome):
    """
    Canary: whether or not the settings injection works
    """

    obj = default_settings()
    inject_settings(obsidian)
    assert get_settings_data(obsidian) == obj
