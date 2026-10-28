const { Builder, By, until } = require('selenium-webdriver');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');

// Create an interface to allow tester to press the enter button when doing testing
const rl = readline.createInterface({ input: stdin, output: stdout });

const BASE_URL = 'https://opencart.abstracta.us/';
const CART_URL = BASE_URL + 'index.php?route=checkout/cart';

// Pause the test so tester can see the website's current state, inspect, and take screenshots
async function pause(message) {
    await rl.question(`\n${message}\nPress Enter to continue... `);
}

// Find the product links displayed on the homepage (wait up to 10 seconds for product links to appear)
async function getProductLinks(driver) {
    return await driver.wait(
        until.elementsLocated(By.css('.product-thumb h4 a')),
        10000
    );
}

// Open the homepage and select a product using its index
// Example: Index 0 selects the first product and index 1 seects the second product
async function selectProduct(driver, index) {
    await driver.get(BASE_URL);

    // Retrieve all available product links from the homepage
    const links = await getProductLinks(driver);

    // Stop the test if the requested product does not exist
    if (links.length <= index) {
        throw new Error(`Product number ${index + 1} was not found.`);
    }

    // Get the selected product's name and URL
    const link = links[index];
    const productName = await link.getText();
    const productUrl = await link.getAttribute('href');

    console.log('Selected product:', productName);

    // Navigate to the selected product's detail page
    await driver.get(productUrl);

    // Wait until add to cart button is available
    await driver.wait(
        until.elementLocated(By.id('button-cart')),
        10000
    );

    // Return the product information for use in later test steps
    return { productName, productUrl };
}

// Add the currently displayed product to the shopping cart
async function addCurrentProduct(driver) {
    await driver.findElement(By.id('button-cart')).click();

    // Wait until the website displays a successful-addition message
    await driver.wait(async () => {
        const alerts = await driver.findElements(
            By.css('.alert-success')
        );
        return alerts.length > 0;
    }, 10000);

    // Retrieve and print the confirmation message
    const alert = await driver.findElement(
        By.css('.alert-success')
    );

    console.log('Website message:', await alert.getText());
}

// Open the shopping cart so its contents can be inspected
async function inspectCart(driver) {
    await driver.get(CART_URL);

    // Wait for the cart page body to load
    await driver.wait(
        until.elementLocated(By.css('body')),
        10000
    );

    // Display the current URL and allow manual inspection
    console.log('Cart URL:', await driver.getCurrentUrl());
    console.log('Cart page loaded. Inspect the products in Chrome.');

    //Pause so tester can view, inspect, and take screenshot of the shopping cart
    await pause('Current state of shopping cart');
}

// Main function that runs all three test scenarios
async function main() {
    // Start a new Chrome browser session with Selenium WebDriver
    const driver = await new Builder()
        .forBrowser('chrome')
        .build();

    try {
        // SCENARIO 1: Add one product
        console.log('\nSCENARIO 1: Add one product');

        // Select the first product on the homepage
        const firstProduct = await selectProduct(driver, 0);

        // Add the selected product and inspect the confirmation
        await addCurrentProduct(driver);
        await pause('Add to Cart confirmation');

        // Open the cart to verify the product was added
        await inspectCart(driver);

        // SCENARIO 2: Add a different product
        console.log('\nSCENARIO 2: Add a different product');

        // Select the second product on the homepage
        const secondProduct = await selectProduct(driver, 1);

        // Check that the second product is different from the first
        if (secondProduct.productUrl === firstProduct.productUrl) {
            throw new Error('The two selected products are the same');
        }

        // Add the second product and inspect the confirmation
        await addCurrentProduct(driver);
        await pause('Second product confirmation');

        // Open the cart to verify its contents
        await inspectCart(driver);

        // SCENARIO 3: Add the first product to the cart again
        console.log('\nSCENARIO 3: Add the same product again');

        // Return directly to the first product's details page
        await driver.get(firstProduct.productUrl);

        // Wait until the add to cart button is available
        await driver.wait(
            until.elementLocated(By.id('button-cart')),
            10000
        );

        // Add the same product again and inspect the confirmation
        await addCurrentProduct(driver);
        await pause('Repeated-addition confirmation');

        // Open the cart to inspect the result of adding the product again
        await inspectCart(driver);

        // Indicate that all test actions have finished
        console.log('\nTesting is completed');

        // Keep the browser open until tester has inspected the final state
        await pause('Final browser state');

    } catch (error) {
        // Display any error that occurs while executing the test
        console.error('\nT007 execution error:', error.message);
        // Allow the user to inspect Chrome before the browser closes
        await pause('The test stopped. Inspect Chrome before closing.');
        // Mark the test execution as unsuccessful
        process.exitCode = 1;
    } finally {
        // Close the browser and the command line input interface
        await driver.quit();
        rl.close();
    }
}

// run the main test function
main();