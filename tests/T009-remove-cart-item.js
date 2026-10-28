const { Builder, By, until } = require('selenium-webdriver');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');

// Create an interface for pausing the test and wait for user input
const rl = readline.createInterface({
    input: stdin,
    output: stdout
});

// Define the website homepage and shopping cart URLs
const BASE_URL = 'https://opencart.abstracta.us/';
const CART_URL = BASE_URL + 'index.php?route=checkout/cart';

// Store the direct URLs for the MacBook and iPhone product pages
const MACBOOK_URL =
    BASE_URL + 'index.php?route=product/product&product_id=43';

const IPHONE_URL =
    BASE_URL + 'index.php?route=product/product&product_id=40';

// Pause execution to tester can inspect the page, view webpage's state, and take screenshots if needed
async function pause(message) {
    await rl.question(
        `\n${message}\nPress Enter to continue... `
    );
}

// Find a specific product's row in the cart.
async function getProductRow(driver, productName) {
    const rows = await driver.findElements(
        By.css('#content .table-responsive tbody tr')
    );

    // Check each row to find the requested product name
    for (const row of rows) {
        const links = await row.findElements(
            By.css('td:nth-child(2) a')
        );

        if (links.length > 0) {
            const name = (await links[0].getText()).trim();

            // Return the row if the product matches the requested name
            if (name === productName) {
                return row;
            }
        }
    }

    // Return null if the product is not found
    return null;
}

// Retrieve the names of all products currently in the cart
async function getCartProducts(driver) {
    // Find the rows representing products in the cart
    const rows = await driver.findElements(
        By.css('#content .table-responsive tbody tr')
    );

    // Create an array to store the product names
    const products = [];

    // Extract the name from each row
    for (const row of rows) {
        const links = await row.findElements(
            By.css('td:nth-child(2) a')
        );

        if (links.length > 0) {
            const name = (await links[0].getText()).trim();
            products.push(name);
        }
    }

    // Return the list of product names
    return products;
}

// Display the products currently in the shopping cart
async function inspectCart(driver) {
    const products = await getCartProducts(driver);

    // Check whether the cart contains any products
    if (products.length === 0) {
        // Read the page text to check for the empty-cart message
        const bodyText = await driver.findElement(
            By.css('body')
        ).getText();

        if (/your shopping cart is empty/i.test(bodyText)) {
            console.log('Cart status: Your shopping cart is empty.');
        } else {
            console.log('No cart products found. Check the page manually.');
        }

        return products;
    }

    // Print the name of each product in the cart
    console.log('Products currently in cart:');

    for (const product of products) {
        console.log(`- ${product}`);
    }

    return products;
}

// Add a specified product to the shopping cart
async function addProduct(driver, productUrl, productName) {
    await driver.get(productUrl);

    // Wait for teh add to cart button to appear
    const addButton = await driver.wait(
        until.elementLocated(By.id('button-cart')),
        10000
    );

    // Ensure the button is visible before clicking it
    await driver.wait(
        until.elementIsVisible(addButton),
        10000
    );

    // Add the product to the cart
    await addButton.click();

    // Wait until the website displays a visible success message
    await driver.wait(async () => {
        const alerts = await driver.findElements(
            By.css('.alert-success')
        );

        for (const alert of alerts) {
            if (await alert.isDisplayed()) {
                return true;
            }
        }

        return false;
    }, 10000);

    console.log(`${productName} added to cart.`);

    // Wait until the requested product appears in the cart
    await driver.get(CART_URL);

    await driver.wait(
        until.elementLocated(By.css('#content')),
        10000
    );

    await driver.wait(async () => {
        return (await getProductRow(driver, productName)) !== null;
    }, 10000);
}

// Remove a product and wait for the cart to update.
async function removeProduct(driver, productName) {
    // Find the row for the product that will be removed
    const row = await getProductRow(driver, productName);

    // Stop the test if the product is not present
    if (!row) {
        throw new Error(
            `${productName} was not found in the cart before removal.`
        );
    }

    // Locate the remove button in the product's row
    const removeButton = await row.findElement(
        By.css('button.btn-danger')
    );

    console.log(`Clicking Remove for ${productName}...`);

    // Click remove to delete the product from the cart
    await removeButton.click();

    // Wait until the selected product disappears.
    // The cart may show other products or an empty-cart message.
    await driver.wait(async () => {
        const updatedRow = await getProductRow(driver, productName);

        // Continue waiting if the product is still present
        if (updatedRow) {
            return false;
        }

        // Check the page for the empty-cart message
        const bodyText = await driver.findElement(
            By.css('body')
        ).getText();

        // Retrieve the remaining products
        const products = await getCartProducts(driver);

        // Finish waiting when other products remain or the cart is empty
        return products.length > 0 ||
            /your shopping cart is empty/i.test(bodyText);
    }, 10000);

    console.log(`Removal response received for ${productName}.`);

    // Display the updated cart and return its product names
    console.log('\nUpdated cart:');
    return await inspectCart(driver);
}

// Set a product quantity and submit the update.
async function setQuantity(driver, productName, quantity) {
    // Find the row of the product whose quantity will change
    const row = await getProductRow(driver, productName);

    if (!row) {
        throw new Error(
            `${productName} was not found in the cart.`
        );
    }

    // Locate the quantity input, clear it, and enter the new value
    const quantityInput = await row.findElement(
        By.css('input[name^="quantity["]')
    );

    await quantityInput.clear();
    await quantityInput.sendKeys(String(quantity));

    // Submit the quantity change using the udpate button
    const updateButton = await row.findElement(
        By.css('button.btn-primary')
    );

    await updateButton.click();

    // Wait until the displayed quantity matches the requested value
    await driver.wait(async () => {
        const updatedRow = await getProductRow(driver, productName);

        if (!updatedRow) {
            return false;
        }

        const input = await updatedRow.findElement(
            By.css('input[name^="quantity["]')
        );

        return (await input.getAttribute('value')) === String(quantity);
    }, 10000);

    // Retrieve the updated row and quantity input
    const updatedRow = await getProductRow(driver, productName);
    const input = await updatedRow.findElement(
        By.css('input[name^="quantity["]')
    );

    // Retrieve the row's cells to read the product total 
    const cells = await updatedRow.findElements(By.css('td'));

    // Print the updated quantity and total price for verification
    console.log(`${productName} quantity:`,
        await input.getAttribute('value'));

    if (cells.length > 5) {
        console.log(
            'Product total:',
            await cells[5].getText()
        );
    }
}

// Main function that executes all 3 removal scenarios
async function main() {
    // Start a new Chrome browser session controlled by Selenium
    const driver = await new Builder()
        .forBrowser('chrome')
        .build();

    try {
        // SCENARIO 1:
        // Remove MacBook while keeping iPhone in the cart.
        console.log('\n====================================');
        console.log('SCENARIO 1: Remove one product');
        console.log('====================================');

        // Add both products so the cart contains two different items
        await addProduct(driver, MACBOOK_URL, 'MacBook');
        await addProduct(driver, IPHONE_URL, 'iPhone');

        // Display the cart contents before removal
        console.log('\nCart before removal:');
        await inspectCart(driver);

        await pause(
            '2 products are in the cart'
        );

        // Remove MacBook and retrieve the remaining products
        const scenario1Products = await removeProduct(
            driver,
            'MacBook'
        );

        // Pass if MacBook is gone and iPhone remains
        const scenario1Pass =
            !scenario1Products.includes('MacBook') &&
            scenario1Products.includes('iPhone');

        console.log(
            'Scenario 1 expected result observed:',
            scenario1Pass ? 'YES' : 'NO'
        );

        await pause(
            'MacBook was removed'
        );

        // SCENARIO 2: Remove the last remaining product.
        console.log('\n====================================');
        console.log('SCENARIO 2: Remove the last product');
        console.log('====================================');

        // Inspect the cart, which should only have iPhone
        console.log('\nCart before removal:');
        await inspectCart(driver);

        await pause(
            'iPhone is still in the cart'
        );

        // Remove iPhone and retrieve the updated cart contents
        const scenario2Products = await removeProduct(
            driver,
            'iPhone'
        );

        // Pass if no products remain and the empty-cart message appears
        const scenario2Body = await driver.findElement(
            By.css('body')
        ).getText();

        const scenario2Pass =
            scenario2Products.length === 0 &&
            /your shopping cart is empty/i.test(scenario2Body);

        console.log(
            'Scenario 2 expected result observed:',
            scenario2Pass ? 'YES' : 'NO'
        );

        await pause(
            'SCENARIO 2: Take a screenshot of the empty cart.'
        );

        // SCENARIO 3: Remove MacBook after increasing its quantity to 2.
        console.log('\n====================================');
        console.log('SCENARIO 3: Remove product with quantity 2');
        console.log('====================================');

        // Add MacBook to prepare the cart for this scenario
        await addProduct(driver, MACBOOK_URL, 'MacBook');

        console.log('\nCart before quantity update:');
        await inspectCart(driver);

        // Increase the MacBook quantity to 2 and display its total 
        await setQuantity(driver, 'MacBook', 2);

        await pause(
            '2 MacBooks are in the cart'
        );

        // Remove MacBook after its quantity has been increased
        const scenario3Products = await removeProduct(
            driver,
            'MacBook'
        );

        // Read the page text to verify the cart is empty
        const scenario3Body = await driver.findElement(
            By.css('body')
        ).getText();

        // Pass if no products remain and the empty-cart message appears
        const scenario3Pass =
            scenario3Products.length === 0 &&
            /your shopping cart is empty/i.test(scenario3Body);

        console.log(
            'Scenario 3 expected result observed:',
            scenario3Pass ? 'YES' : 'NO'
        );

        await pause(
            'Cart is now empty.'
        );

        // Print the final outcome reported for each scenario
        console.log('\n====================================');
        console.log('TC09 TEST ACTIONS COMPLETED');
        console.log('====================================');
        console.log('Scenario 1:', scenario1Pass ? 'Expected result observed' : 'Check actual result');
        console.log('Scenario 2:', scenario2Pass ? 'Expected result observed' : 'Check actual result');
        console.log('Scenario 3:', scenario3Pass ? 'Expected result observed' : 'Check actual result');


        // Allow a final inspection before the browser closes
        await pause('Review the final browser state before closing.');

    } catch (error) {
        // Display any error encountered during test execution
        console.error('\nT009 execution error:', error.message);

        // Pause so the user can inspect the browser
        await pause(
            'Testing is done'
        );

        // Mark the test execution as unsuccessful
        process.exitCode = 1;

    } finally {
        // Close Chrome and the command line input interface
        await driver.quit();
        rl.close();
    }
}

// Execute the test suite
main();