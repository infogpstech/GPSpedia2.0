# verify_full_fix_v2.py
import asyncio
from playwright.async_api import async_playwright, expect
import json

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Capture and print all browser console logs
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

        mock_session = {
            "ID": "1",
            "Nombre_Usuario": "testuser",
            "Nombre_Completo": "Test User Full Name",
            "Privilegios": "Desarrollador",
            "SessionToken": "valid-token-123"
        }

        async def handle_route(route):
            request = route.request
            if "script.google.com" in request.url:
                payload = request.post_data_json
                action = payload.get("action")

                if action == "validateSession":
                    print(f"Mocking action: {action} -> returning valid:true")
                    await route.fulfill(status=200, content_type="text/plain", body='{"valid":true}')
                    return

                if action == "getCatalogData":
                     print(f"Mocking action: {action}")
                     await route.fulfill(status=200, content_type="text/plain", body='{"cortes": [{"id":1, "marca":"Test"}], "tutoriales":[], "relay":[]}')
                     return

                if action == "getUsers":
                    print(f"Mocking action: {action}")
                    if payload.get("payload", {}).get("sessionToken") == "valid-token-123":
                        await route.fulfill(status=200, content_type="text/plain", body='{"status":"success","users":[{"ID":"1","Nombre_Usuario":"testuser","Nombre_Completo":"Test User Full Name","Privilegios":"Desarrollador"}]}')
                    else:
                        await route.fulfill(status=401, content_type="text/plain", body='{"status":"error","message":"Unauthorized"}')
                    return

            await route.continue_()

        await page.route("**/*", handle_route)

        print("Navigating to index.html...")
        await page.goto("http://localhost:8000/index.html")

        print("Injecting session data into localStorage...")
        await page.evaluate(f'localStorage.setItem("gpsepedia_session", {json.dumps(mock_session)})')

        # Add debug hooks into the app's modules
        await page.evaluate('''() => {
            console.log('Attaching debug hooks...');
            // We need to modify the imported modules, which is tricky.
            // Awaiting the modules to load might be too late.
            // Instead, we will directly hook into the functions on the window object
            // after initializeApp runs.
        }''')

        print("Reloading page to trigger startup logic...")
        await page.reload()

        # Manually trigger display logic to see if it works, bypassing the app's own flow
        print("Forcing main container to be visible for debugging...")
        await page.evaluate('document.querySelector(".container").style.display = "block"')

        print("Waiting for 2 seconds to observe behavior...")
        await asyncio.sleep(2)

        screenshot_path = "full_fix_verification_debug.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        print("\n--- DEBUGGING ANALYSIS ---")
        print("The script failed to see the container become visible on its own.")
        print("I have forced the container to be visible to capture a screenshot of the state.")
        print("The browser logs should reveal where the JavaScript execution is halting after the session is validated.")
        print("Checking the logs for errors after 'initializeApp' and 'checkSession'...")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
