
import asyncio
from playwright.async_api import async_playwright
import os
import json

async def main():
    """
    Main function to run the Playwright script.
    """
    session_data_str = os.environ.get("SESSION_DATA")
    if not session_data_str:
        print("Error: SESSION_DATA environment variable not set.")
        return

    try:
        session_data = json.loads(session_data_str)
        print("Successfully parsed session data.")
    except json.JSONDecodeError as e:
        print(f"Error parsing SESSION_DATA JSON: {e}")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Create a new context with the session data
        # This is more reliable than injecting after navigation
        try:
            context = await browser.new_context(
                storage_state={"origins": [{
                    "origin": "http://localhost:8000",
                    "localStorage": [{
                        "name": "gpsepedia_session",
                        "value": json.dumps(session_data)
                    }]
                }]}
            )
            print("Browser context created with session data.")
        except Exception as e:
            print(f"Error creating browser context: {e}")
            await browser.close()
            return

        page = await context.new_page()

        try:
            # Navigate to the page
            await page.goto("http://localhost:8000/index.html", wait_until="networkidle", timeout=20000)
            print("Navigation to index.html successful.")

            # The splash screen should hide automatically, but we can force it
            await page.evaluate("document.getElementById('splash-screen').style.display = 'none'")
            print("Splash screen explicitly hidden.")

            # Wait for the main container to be visible
            await page.wait_for_selector(".container", state="visible", timeout=15000)
            print("Main container '.container' is visible.")

            # Take a screenshot
            screenshot_path = "revert_verification.png"
            await page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"An error occurred during page interaction: {e}")
            await page.screenshot(path="revert_error.png")
            print("Error screenshot saved to revert_error.png")
        finally:
            await browser.close()
            print("Browser closed.")

if __name__ == "__main__":
    # Ensure the server is running in the background
    # Note: The server is started by the calling bash script
    asyncio.run(main())
