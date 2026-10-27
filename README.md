# 32571-Assignment3 (System Testing)
This repository contains automated test scrips for the shopping cart functions of the OpenCart Abstracta demo website (https://opencart.abstracta.us/) for Enterprise Software Testing assignment.

# Tools Used:
- JavaScript
- Selenium WebDriver
- Node.js
- Google Chrome

# Test Cases:
- T007 (Add Product to Cart): Tests adding one product, different products, and the same product again.
- T008 (Update Cart Quantity): Tests increasing quantity, decreasing quantity, and entering quantity 0.
- T009 (Remove Cart Item): Tests removing one product, the last product, and a product with quantity greater than 1.

# How to Run:
- Install the dependency: npm install selenium-webdriver
- Run each test from the project folder:
    - node tests/T007-add-to-cart.js
    - node tests/T008-update-cart-quantity.js
    - node tests/T009-remove-cart-item.js