/*
 * Pricing JS Scripts 
 * This JavaScript file handles pricing on every page of the website The functions in this file are responsible for calculating the total price of items in the shopping cart, updating the sidebar with item and price information, and integrating with PayPal for payment processing.
 * @author Email Plain and Simple 
*/


   /* Retrieves cart data from localStorage and initializes pricing definition.
	 * It also selects various DOM elements for cart functionality. The following are the main components:
	 * cartData: An object that stores cart data retrieved from localStorage or an empty object if none exists.
	 * pricingDef: An object containing pricing information for different items.
	 * minusBtns, plusBtns, quantitiesBtns, and removeBtns: NodeLists containing the respective DOM elements.
	 * quantities: An empty object that will later store the quantities of each item in the cart.
	 *
	*/
	    let cartData = JSON.parse(localStorage.getItem("cart")) || {};
	    const pricingDef ={'emails'    :{'title':'Small Email', 'price': .25}, 
						  'largeemails' :{'title':'Large Email', 'price': .50}, 
						  'forwards'    :{'title':'Email Forwards','price': .25},
						  'consultation':{'title':'Consultation Hours','price': 55},
						  }; 
		const minusBtns      = document.querySelectorAll(".minus-btn");
		const plusBtns       = document.querySelectorAll(".plus-btn");
		const quantitiesBtns = document.querySelectorAll("input[type='text']");
		const removeBtns     = document.querySelectorAll(".remove");
		let   quantities     = {}; 
	  

	  minusBtns.forEach((btn, index) => {
		btn.addEventListener("click", (e) => {
		  e.preventDefault();
			let idx = btn.parentElement.getAttribute('data-index');              									  
			quantities[idx].value--; 
			 if(quantities[idx].value < 0){quantities[idx].value = 0} 
			updateCartData(idx);
			calculateTotalPrice();
			updateSideBar(); 
		});
	  });

	  plusBtns.forEach((btn, index) => {
		btn.addEventListener("click", (e) => {
		e.preventDefault();
			let idx = btn.parentElement.getAttribute('data-index');
		  quantities[idx].value++;
		  updateCartData(idx);
		  calculateTotalPrice();
		  updateSideBar(); 
		});
	  });

	  removeBtns.forEach((btn, index) => {
		btn.addEventListener("click", (e) => {
			e.preventDefault();
		   let idx = btn.parentElement.getAttribute('data-index');
		  delete cartData[idx];	  
		  quantities[idx].value = '';
		  updateCartData(idx);
		  calculateTotalPrice();
		  updateSideBar(); 
		});
	  });
	  
	  getCartData();
	  quantitiesBtns.forEach((btn)=> {	  
		  let idx = btn.parentElement.getAttribute('data-index'); 
		  quantities[idx] = btn; 
		  quantities[idx].value = cartData[idx] || '';
	   });
	  

   
   /* This function updates the cart data in localStorage with new quantity values based on the index of the cart item.
	* It starts by retrieving the new quantity value from the corresponding input field in the DOM and stores it in the cartData object.
	* It then clears any invalid cart data, updates the localStorage with the new cartData object, and finally, recalculates the total price.
	* The function takes one argument:
	* idx: An integer that represents the index of the cart item to be updated.
	*/
		
	  function updateCartData(idx) {
		const quantity = quantities[idx].value;
		cartData[idx] = quantity;
		clearInvalidCartData();
		localStorage.setItem("cart", JSON.stringify(cartData));
		calculateTotalPrice();
	  }
	  
	  
	  /* This is a function that retrieves cart data from localStorage and initializes the cartData object.
       * If cart data is present in localStorage, it is parsed from JSON and assigned to cartData.
       * If parsing fails or no cart data is present, an empty object is assigned to cartData.
       * The function also clears any invalid cart data and is called upon page load to initialize the cart.
	  */ 
	  
	    function getCartData() { 
		  try {
			  const cartJson = localStorage.getItem("cart");
			  cartData = JSON.parse(cartJson);
		  } catch(e) {
			  cartData = {};
		  }
		  if(!cartData){
			  cartData = {};
		  }  	  
		  clearInvalidCartData();
	    }
	  
	  // Function to Clear Invalid Cart Data 
	  
	    function clearInvalidCartData() {
		  if(cartData){
			Object.keys(cartData).forEach(key => { if(!pricingDef.hasOwnProperty(key)) { delete cartData[key]; }});
		} 
	  
	    }

	
	/*	This function calculates the total price of items in the user's cart based on the stored cart data in local storage.
	 *	It loops through the cart data and calculates the price of each item based on the quantity and price per item from the pricingDef object.
	 *	It also updates the cart counter and total price display in the HTML page, as well as the total price value in local storage.
	 *  It also updates the PayPal payment amount and sets up the PayPal payment button.
	*/
	  function calculateTotalPrice() {
		const cartData = JSON.parse(localStorage.getItem("cart")) || {};
		let totalPrice = 0; 
		let cartCount = 0; 
		for (const item in cartData) {
		  const quantity = cartData[item];
		  cartCount += Number(quantity); 
		  var pricePer = pricingDef[item].price; 
		  const price =  (quantity) * pricePer; 
		  totalPrice += price;
		}
		
		let cartCountDiv = document.getElementById("cart-counter"); 
		if(cartCountDiv){
			cartCountDiv.innerHTML = cartCount;
		}
		
		let	totalPriceDiv         = document.getElementById("total_price_amount");
		if(totalPriceDiv){
			totalPriceDiv.textContent         = `$${totalPrice.toFixed(2)}`;
		}						  
	  
	    // Add total price to local storage
		localStorage.setItem("totalPrice", totalPrice.toFixed(2));
		
	    return totalPrice; 
	  
	  }

	  // Initialize total price on page load
	  calculateTotalPrice();
	  
	  
	  // This function  is the paypal checkout function 
	    function payPalCheckout(){
			
			var finalPrice = calculateTotalPrice();
		  
			// Update PayPal amount to process the order 
			if (paypal && document.getElementById('paypal-button-container')) {
				paypal.Buttons({
					createOrder: function(data, actions) {
					  return actions.order.create({
						purchase_units: [{
						  amount: {
							value: finalPrice
						  }
						}]
					  });
					},
					onApprove: function(data, actions) {
					  return actions.order.capture().then(function(details) {
						window.location.href = "https://emailplainandsimple.com/members-login";
					  });
					}
					}).render('#paypal-button-container');
			}
		  
		  
	    }
		
		// Initialize the paypal checkout  
		
	payPalCheckout(); 
	  
	  
	/*
	 * This function updates the cart sidebar view with the current cart items, their quantity, and their prices.
	 * It fetches the cart data from the local storage and updates the respective HTML elements in the cart sidebar view.
	 * It also retrieves the total price from local storage and updates the total price HTML element.
	*/

	  function updateSideBar() {	
	  
		  if (document.getElementById("branded-emails-td-amount")) {
			if(cartData["emails"] == undefined) {
				document.getElementById("branded-emails-td-amount").textContent = 'Item is Empty' ;
				}else{
				document.getElementById("branded-emails-td-amount").textContent = cartData["emails"] + " "+"x $0.25" || "" ;
				}
		  }  
		  if (document.getElementById("large-emails-td-amount")) {
			if(cartData["largeemails"] == undefined) {
				document.getElementById("large-emails-td-amount").textContent = 'Item is Empty' ;
				}else{
				document.getElementById("large-emails-td-amount").textContent = cartData["largeemails"] + " "+"x $0.50" || "" ;
				}
		  }
		  if (document.getElementById("emails-forwards-td-amount")) {
			if(cartData["forwards"] == undefined) {
				document.getElementById("emails-forwards-td-amount").textContent = 'Item is Empty';
				}else{
				document.getElementById("emails-forwards-td-amount").textContent = cartData["forwards"]+ " "+"x $0.25" || "";
				}
		  }
		  if (document.getElementById("emails-forwards-td-amount")) {
			if(cartData["consultation"] == undefined) {
				document.getElementById("consult-hours-td-amount").textContent = 'Item is Empty';
				}else{
				document.getElementById("consult-hours-td-amount").textContent = cartData["consultation"]  || "";
				}
		  }	  
		  if (document.getElementById("total_price_amount_side")) {  
				const totalPrice = localStorage.getItem('totalPrice');
				const totalPriceAmountDiv = document.getElementById('total_price_amount_side');
				totalPriceAmountDiv.innerHTML = '$' + totalPrice;
		  } 
		  	   
	  }
	  
	  
	/* Add event listeners to the cart icon and close button in the cart sidebar.
	 * When the cart icon is moused over, it toggles the "show" class on the cart sidebar to display or hide it.
	 * If the close button is present, it adds an event listener to it that removes the "show" class from the cart sidebar when clicked.
	 * This block of code is executed when the DOM content is loaded to initialize the cart icon and sidebar behavior.
	 */			
			
	document.addEventListener('DOMContentLoaded', function() {
		var cartIcon = document.querySelector('.fa.fa-shopping-cart');
		var cartSidebar = document.querySelector('.cart-sidebar');
		var closeButton = document.querySelector('.close-button');
		var signupSubmit = document.querySelector('#template-contactform-submit');
		var submitSidebar = document.querySelector('.submit-sidebar');
		var submitCloseButton = document.querySelectorAll('.submit-close-button');
		
		cartIcon.addEventListener('mouseover', function() {
		  cartSidebar.classList.add('show');
		});
		if (closeButton) {
			closeButton.addEventListener('click', function() {
				cartSidebar.classList.remove('show');
			});
		}
		
		signupSubmit.addEventListener('click', function(evt) {
		  evt.preventDefault();
		  submitSidebar.classList.add('show');
		});
		
		if (submitCloseButton) {
			submitCloseButton.forEach(item => {
				item.addEventListener('click', function() {
					submitSidebar.classList.remove('show');
				});
			});
		}
	});

    // Intialize the update sidebar cart 
	
     updateSideBar();
							  
		

		