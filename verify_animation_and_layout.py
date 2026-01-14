import asyncio
from playwright.async_api import async_playwright, expect
import subprocess
import time
import os

async def main():
    server_process = None
    # Create a directory for the verification screenshots if it doesn't exist
    os.makedirs("verification_screenshots", exist_ok=True)
    try:
        # 1. Start the local web server
        print("Starting local server...")
        # Ensure the port is free before starting
        os.system("kill $(lsof -t -i:8000) > /dev/null 2>&1 || true")
        time.sleep(1)
        server_process = subprocess.Popen(
            ['python3', 'server.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        time.sleep(2)

        if server_process.poll() is not None:
            stdout, stderr = server_process.communicate()
            print("Error starting server.")
            print(f"STDOUT: {stdout}")
            print(f"STDERR: {stderr}")
            return
        print("Server started successfully.")

        # 2. Run Playwright test logic
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            # Use a new context with service workers blocked to prevent caching issues
            context = await browser.new_context(service_workers="block")

            # Inject dummy session data to bypass login
            await context.add_init_script("""
                localStorage.setItem('sessionToken', 'dummy_token');
                localStorage.setItem('userId', 'dummy_user');
            """)

            page = await context.new_page()

            try:
                # Mock the API response with valid catalog data
                with open('tests/mock_catalog_data.json', 'r') as f:
                    mock_data = f.read()

                await page.route("**/macros/s/**", lambda route: route.fulfill(
                    status=200,
                    content_type="text/plain;charset=UTF-8",
                    body=mock_data
                ))

                # Navigate and wait for the app to be ready
                await page.goto("http://localhost:8000/")
                await page.wait_for_load_state('domcontentloaded')
                await page.wait_for_function('() => window.state && window.ui && window.navigation')
                await page.evaluate("window.ui.showApp()")
                await page.wait_for_timeout(1000) # Wait for UI to settle

                # --- TEST LOGIC START ---
                print("--- Starting Test: Animation and Layout Verification ---")

                # 1. Verify Initial Compact Layout
                print("Step 1: Verifying initial compact layout...")
                initial_screenshot_path = "verification_screenshots/01_initial_compact_layout.png"
                await page.screenshot(path=initial_screenshot_path)
                print(f"OK: Screenshot of initial layout saved to '{initial_screenshot_path}'")

                # 2. Activate Search and Verify Animation
                print("Step 2: Activating search and verifying animation...")
                await page.click("#searchInput")
                await page.wait_for_timeout(1000) # Wait for animation to complete

                search_active_screenshot_path = "verification_screenshots/02_search_active_animation.png"
                await page.screenshot(path=search_active_screenshot_path)
                print(f"OK: Screenshot of search-active state saved to '{search_active_screenshot_path}'")

                # 3. Deactivate Search and Verify Return to Compact Layout
                print("Step 3: Deactivating search and verifying return to compact layout...")
                # Click on the body to remove focus from the search input
                await page.click("body")
                await page.wait_for_timeout(500) # Wait for animation to complete

                final_screenshot_path = "verification_screenshots/03_return_to_compact_layout.png"
                await page.screenshot(path=final_screenshot_path)
                print(f"OK: Screenshot of final state saved to '{final_screenshot_path}'")

                print("\n--- TEST COMPLETED SUCCESSFULLY ---")
                print("Please review the screenshots in the 'verification_screenshots' directory.")

            except Exception as e:
                print(f"\n--- ERROR DURING TEST ---")
                print(f"{e}")
                error_screenshot_path = "verification_screenshots/error_screenshot.png"
                await page.screenshot(path=error_screenshot_path)
                print(f"Error screenshot saved to '{error_screenshot_path}'")

    finally:
        # 3. Safely stop the server
        if server_process:
            print("Stopping the server...")
            server_process.terminate()
            try:
                server_process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                print("Server did not terminate in time, killing process.")
                server_process.kill()
        # Final cleanup of the port
        os.system("kill $(lsof -t -i:8000) > /dev/null 2>&1 || true")

if __name__ == '__main__':
    asyncio.run(main())
