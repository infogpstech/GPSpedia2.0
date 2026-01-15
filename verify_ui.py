
import asyncio
from playwright.async_api import async_playwright
import json

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        # This mock is just to ensure the page doesn't crash on startup
        async def mock_api(route):
            await route.fulfill(status=200, content_type="text/plain", body=json.dumps({"status": "success"}))
        await page.route("**/api**", mock_api)
        await page.route("**/script.google.com/**", mock_api)

        await page.goto("http://localhost:8000", wait_until="networkidle")

        # The test data cases
        test_cases = [
            {"name": "ID Simple", "input": "1-9f9w9dof9w9d"},
            {"name": "URL Compartir /file/d/", "input": "https://drive.google.com/file/d/1-8QqhS-wtEFFwyBG8CmnEOp5i8rxSM-2/view?usp=sharing"},
            {"name": "URL Thumbnail", "input": "https://drive.google.com/thumbnail?id=1NxBx-W_gWmcq3fA9zog6Dpe-WXpH_2e8"},
            {"name": "URL Externa", "input": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/2018_Yamaha_YZF-R1_blue.jpg/320px-2018_Yamaha_YZF-R1_blue.jpg"},
            {"name": "ID Inválido", "input": "id invalido con espacios"},
            {"name": "URL GDrive con ?id=", "input": "https://drive.google.com/file/d/1O-111111111111111111/view?usp=drivesdk&id=1O-111111111111111111"},
            {"name": "Null Input", "input": None},
            {"name": "Empty Input", "input": ""}
        ]

        # Use page.evaluate to run the test directly in the browser's context
        await page.evaluate('''async (test_cases) => {
            const container = document.createElement('div');
            container.id = 'test-container';
            container.style.padding = '20px';
            document.body.innerHTML = ''; // Clear the body
            document.body.appendChild(container);

            const title = document.createElement('h1');
            title.textContent = 'Verificación Aislada de getImageUrl';
            container.appendChild(title);

            for (const test of test_cases) {
                const resultUrl = window.ui.getImageUrl(test.input);

                const testDiv = document.createElement('div');
                testDiv.style.border = '1px solid #ccc';
                testDiv.style.padding = '10px';
                testDiv.style.margin = '10px 0';

                const testTitle = document.createElement('h3');
                testTitle.textContent = test.name;
                testDiv.appendChild(testTitle);

                const inputPre = document.createElement('pre');
                inputPre.textContent = `Input: ${test.input}`;
                testDiv.appendChild(inputPre);

                const outputPre = document.createElement('pre');
                outputPre.textContent = `Output: ${resultUrl}`;
                outputPre.style.color = 'blue';
                testDiv.appendChild(outputPre);

                const img = document.createElement('img');
                img.src = resultUrl;
                img.style.width = '280px';
                img.style.height = '200px';
                img.style.border = '2px solid green';
                // Use onerror to visually flag failures
                img.onerror = () => {
                    img.style.border = '2px solid red';
                    img.alt = 'Error de Carga';
                };
                testDiv.appendChild(img);

                container.appendChild(testDiv);
            }
        }''', test_cases)

        await page.wait_for_timeout(2000) # Wait for images to load

        print("Taking definitive screenshot of isolated test results...")
        await page.screenshot(path="screenshot_isolated_verification.png", full_page=True)

        await browser.close()
        print("Isolated verification script finished successfully.")

asyncio.run(main())
