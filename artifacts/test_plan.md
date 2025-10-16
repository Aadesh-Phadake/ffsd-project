# 🧪 Test Plan — TravelNest Application

## 📋 Overview
This test plan describes all the **validation** and **asynchronous (async)** test cases performed on the **TravelNest Web Application**.  
The project includes user authentication, profile management, hotel listing creation, and dynamic AJAX-based dashboard operations.

---

## ✅ 1. Validation Test Cases

### **V1 — Login Validation (Empty Username)**
- **Feature:** Login Form  
- **Input:** username = "", password = "123"  
- **Expected Result:** Show error — “Please enter a correct UserName”  
- **Actual Result:** Error message displayed correctly  
- **Status:** ✅ Pass  

---

### **V2 — Login Validation (Valid Credentials)**
- **Feature:** Login Form  
- **Input:** username = "aadesh", password = "pass123"  
- **Expected Result:** Redirect to dashboard page  
- **Actual Result:** Redirect successful  
- **Status:** ✅ Pass  

---

### **V3 — Signup Validation (Invalid Email Format)**
- **Feature:** Signup Form  
- **Input:** username = "test", email = "abc@", password = "123"  
- **Expected Result:** Show error — “Please enter a valid email”  
- **Actual Result:** Validation message shown properly  
- **Status:** ✅ Pass  

---

### **V4 — Signup Validation (Valid Details)**
- **Feature:** Signup Form  
- **Input:** username = "test", email = "user@gmail.com", password = "abc123"  
- **Expected Result:** Redirect to login page after successful signup  
- **Actual Result:** Redirected correctly  
- **Status:** ✅ Pass  

---

### **V5 — Listing Creation (Empty Title)**
- **Feature:** Create Listing  
- **Input:** title = "", description = "Nice hotel"  
- **Expected Result:** “Title Looks Good” feedback not shown  
- **Actual Result:** Works as expected  
- **Status:** ✅ Pass  

---

### **V6 — Listing Creation (20+ Images)**
- **Feature:** Add Images  
- **Input:** 21 image URLs added  
- **Expected Result:** “Add Another Image URL” button disabled after 20 URLs  
- **Actual Result:** Disabled correctly  
- **Status:** ✅ Pass  

---

## ⚙️ 2. Asynchronous (Async) Test Cases

### **A1 — Hotel Load (AJAX)**
- **Feature:** Dashboard — My Hotels tab  
- **Steps:** Trigger `/dashboard/hotels` fetch  
- **Expected Result:** List of hotels loads dynamically without page reload  
- **Actual Result:** Data loaded successfully  
- **Status:** ✅ Pass  

---

### **A2 — Hotel Load Error Handling**
- **Feature:** Dashboard — My Hotels tab  
- **Steps:** Disconnect backend or modify API URL  
- **Expected Result:** Display “Error Loading Hotels” message  
- **Actual Result:** Error handled properly  
- **Status:** ✅ Pass  

---

### **A3 — Dashboard Search (Existing Hotel)**
- **Feature:** AJAX Search  
- **Steps:** Type partial hotel name and click Search  
- **Expected Result:** Matching bookings displayed dynamically  
- **Actual Result:** Works correctly  
- **Status:** ✅ Pass  

---

### **A4 — Dashboard Search (No Results)**
- **Feature:** AJAX Search  
- **Steps:** Type “xyz123” as search term  
- **Expected Result:** Show “No bookings found” message  
- **Actual Result:** Displayed properly  
- **Status:** ✅ Pass  

---

### **A5 — Cancel Booking (AJAX)**
- **Feature:** Profile Page  
- **Steps:** Click Cancel button (triggers `/profile/cancel/:id`)  
- **Expected Result:** Booking removed without page reload  
- **Actual Result:** DOM updated dynamically  
- **Status:** ✅ Pass  

---

### **A6 — Membership Activation**
- **Feature:** Membership Section  
- **Steps:** Click “Activate ₹999/month” → triggers fetch `/membership/activate`  
- **Expected Result:** Badge turns green “Active until…”  
- **Actual Result:** Status updated correctly  
- **Status:** ✅ Pass  

---

### **A7 — Countdown Timer**
- **Feature:** Dashboard Bookings  
- **Steps:** Wait for active booking to expire  
- **Expected Result:** Status changes from “Active” → “Expired” dynamically  
- **Actual Result:** Works properly  
- **Status:** ✅ Pass  

---

## 🧭 3. Test Environment
- **Browser:** Chrome v141.0  
- **Backend:** Node.js + Express  
- **Frontend:** EJS Templates + Fetch API  
- **Database:** MongoDB Atlas  
- **Testing Tools:** Browser DevTools (Console + Network tab)  
- **Operating System:** Windows 10  

---

## 📊 4. Results Summary
- **Total Validation Tests:** 6 (All Passed)  
- **Total Async Tests:** 7 (All Passed)  

✅ **All critical validation and asynchronous data handling tests passed successfully.**

---

## 📸 5. Evidence
- Screenshots showing:
  - Network tab (API requests `/dashboard/hotels`, `/profile/cancel/:id`)  
  - Validation popups (login/signup errors)  
  - Console logs showing async success/error messages  
- Video demo includes all three async flows (Callback → Promise → Async/Await)

---

## 🧾 6. Conclusion
All validation and async features were tested successfully.  
The application correctly handles:
- Invalid input and form validation  
- Asynchronous API fetching and error handling  
- Dynamic UI updates without reloads  

No major bugs were found. Minor optimizations (like async loading delay) can be considered for future versions.
