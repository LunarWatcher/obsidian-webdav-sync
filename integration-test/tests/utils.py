from selenium.webdriver import Chrome

def execute(driver: Chrome, script: str):
    return driver.execute_cdp_cmd(
        "Runtime.evaluate",
        { "expression": script }
    )
