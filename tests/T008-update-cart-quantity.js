const { Builder, By, until } = require('selenium-webdriver');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');

// Create an interface to pause the test and wait for user input
const rl = readline.createInterface({
    input: stdin,
    output: stdout
});

// Define the website homepage and shopping cart URLs
const BASE_URL = 'https://opencart.abstracta.us/';
const CART_URL =
    BASE_URL + 'index.php?route=checkout/cart';

    // Store the direct URL of the Macbook's product page
    const MACBOOK_URL =
    BASE_URL + 'index.php?route=product/product&product_id=43';

// Pause the test so tester can view the page's state, inspect, and take screenshots if needed
async function pause(message) {
    await rl.question(
        `\n${message}\nPress Enter to continue... `
    );
}

// Find the MacBook row in the shopping cart.
async function getMacBookRow(driver) {
    const rows = await driver.findElements(
        By.css('#content .table-responsive tbody tr')
    );

    // Check each row to identify the product (MacBook)
    for (const row of rows) {
        const nameLinks = await row.findElements(
            By.css('td:nth-child(2) a')
        );

        if (nameLinks.length > 0) {
            // Read the product name and remove extra whitespace
            const name = (await nameLinks[0].getText()).trim();

            // Return the row if the product is a MacBook
            if (name === 'MacBook') {
                return row;
            }
        }
    }

    // Return null if MacBook cannot be found in the cart
    return null;
}

// Display MacBook's quantity, unit price, and product total 
async function inspectMacBook(driver) {
    // Locate the MacBook row in the cart
    const row = await getMacBookRow(driver);

    // Stop inspecting if MacBook is not present
    if (!row) {
        console.log('MacBook is not present in the cart.');
        return null;
    }

    // Read the current quantity from the quantity input field
    const quantityInput = await row.findElement(
        By.css('input[name^="quantity["]')
    );

    const quantity = await quantityInput.getAttribute('value');

    // Retrieve the cells containing the price information
    const cells = await row.findElements(By.css('td'));

    // Read the unit price from the fifth cell, if available
    const unitPrice = cells.length > 4
        ? await cells[4].getText()
        : 'Not found';

    // Read the product total from the sixth cell, if available
    const productTotal = cells.length > 5
        ? await cells[5].getText()
        : 'Not found';

    // Print the current cart information for verification
    console.log('Product: MacBook');
    console.log('Quantity:', quantity);
    console.log('Unit price:', unitPrice);
    console.log('Product total:', productTotal);

    return quantity;
}

// Update MacBook quantity and submit the change
async function updateQuantity(driver, newQuantity) {
    // Find the MacBook row before attempting to update it
    const row = await getMacBookRow(driver);

    // Report an error if the product is missing 
    if (!row) {
        throw new Error(
            'MacBook is missing from the cart before updating.'
        );
    }

    // Clear the existing value and enter the requested quantity
    const quantityInput = await row.findElement(
        By.css('input[name^="quantity["]')
    );

    await quantityInput.clear();
    await quantityInput.sendKeys(String(newQuantity));

    console.log(`Entering quantity: ${newQuantity}`);

    // Locate and click the cart's update button
    const updateButton = await row.findElement(
        By.css('button.btn-primary')
    );

    await updateButton.click();

    // Wait for the main cart content to appear after the update
    await driver.wait(
        until.elementLocated(By.css('#content')),
        10000
    );

    // Wait until either cart rows or cart messages are displayed
    // This accomodates updates that result in an empty cart
    await driver.wait(async () => {
        const rows = await driver.findElements(
            By.css('#content .table-responsive tbody tr')
        );

        const messages = await driver.findElements(
            By.css('#content .alert')
        );

        return rows.length > 0 || messages.length > 0;
    }, 10000);

    // Retrieve any alerts displayed by the website
    const alerts = await driver.findElements(
        By.css('#content .alert')
    );

    // Print each non-empty alert message
    for (const alert of alerts) {
        const message = await alert.getText();

        if (message.trim()) {
            console.log('Website message:', message);
        }
    }

    // Display the cart details after the update
    console.log('\nUpdated cart details:');
    await inspectMacBook(driver);
}

// Main function that runs the setup and 3 test scenarios
async function main() {
    // Launch a new Chrome browser controlled by Selenium
    const driver = await new Builder()
        .forBrowser('chrome')
        .build();

    try {
        // SETUP: Add MacBook to the cart before testing quantities
        console.log('\nSETUP: Prepare the shopping cart');

        // Open the MacBook product page
        await driver.get(MACBOOK_URL);

        // Wait until the add to cart button is available
        await driver.wait(
            until.elementLocated(By.id('button-cart')),
            10000
        );

        // Add MacBook to the shopping cart
        await driver.findElement(By.id('button-cart')).click();

        // Wait for the website's successful-addition message
        await driver.wait(async () => {
            const alerts = await driver.findElements(
                By.css('.alert-success')
            );

            return alerts.length > 0;
        }, 10000);

        console.log('MacBook has been added to the cart.');

        // Open the cart to inspect its initial state
        await driver.get(CART_URL);

        await driver.wait(
            until.elementLocated(By.css('#content')),
            10000
        );

        // Record the initial quantity and price information
        console.log('\nInitial cart details:');
        await inspectMacBook(driver);

        await pause(
            'MacBook is in the cart before being updated'
        );

        // SCENARIO 1: Increase quantity from 1 to 2.
        console.log('\nSCENARIO 1: Increase quantity from 1 to 2');

        // Update the quantity and display the resulting cart details
        await updateQuantity(driver, 2);

        await pause(
            'Quantity in cart was updated'
        );

        // SCENARIO 2: Decrease quantity from 2 to 1.
        console.log('\nSCENARIO 2: Decrease quantity from 2 to 1');

        // Restore the quantity to one and inspect the result
        await updateQuantity(driver, 1);

        await pause(
            'Quantity in cart decreased'
        );

        // SCENARIO 3: Enter invalid quantity 0 to observe website response
        console.log('\nSCENARIO 3: Enter quantity 0');

        // Submit zero and inspect how the website handles it
        await updateQuantity(driver, 0);

        await pause(
            'Website response to quantity 0'
        );

        // Indicate that all test actions have finished
        console.log('\nT008 test completed');

        await pause('Final testing point');

    } catch (error) {
        // Display the error if a test action or wait fails
        console.error('\nTC08 execution error:', error.message);

        // Allow inspection of the browser before it closes
        await pause(
            'The test stopped. Inspect before closing.'
        );

        // Mark the execution as unsuccessful
        process.exitCode = 1;

    } finally {
        // Close Chrome and the command-line input interface
        await driver.quit();
        rl.close();
    }
}

// Execute the test suite
main();