# 🏨 Hotel Booking & Management System

### **Group ID:**  
> `Group-49`

### **Project Title:**  
> **TravelNest - Hotel Booking & Management Platform with Async Data Handling**

### **SPOC (Single Point of Contact):**  
> **Name:** Aadesh Ashok Phadake  
> **Email:** aadeshphadake4@gmail.com 
> **Roll No:** S20230010185

---

## 👥 Team Members & Roles

| Name | Roll No | Role & Contributions |
|------|----------|----------------------|
| **Aadesh Ashok Phadake** | S20230010185 | **Led Backend Integration:** Set up Express routes, designed RESTful APIs, and managed database connectivity. Updated core controllers for listings and user management to integrate admin and payment modules. Contributed to creation of admin and payment views. |
| **Aku Rishita** | S20230010008 | **Backend Controllers:** Implemented business logic, data validation, and error handling. Co-developed the **Admin Dashboard** for listing approvals, user management, and analytics. Contributed a minor feature to the Hotel Owner Dashboard (notifications/UI support). Implemented role-based access and designed user/hotel management and AJAX in the admin dashboard. |
| **Jalla Venkata Sai Ganesh Reddy** | S20230010107 | **Traveler Module:** Built browsing, search, and booking functionalities. Developed the **Payment Page** and **Payment Dashboard** for handling transactions. Implemented membership and AJAX features in *My Profile*. |
| **Kondapalli Hemanth** | S20230010119 | **Database & Dashboards:** Designed Mongoose schemas for users, rooms, and bookings. Built the **User Dashboard** for travelers to manage bookings and profiles. Added maps and designed taxi services. |
| **Padavatan Simon Peter** | S20230010171 | **Authentication & UI Design:** Managed user roles, login, and session management. Designed **CSS styling** and layout for the app. Developed the main part of the **Hotel Owner Dashboard** for hosts and created the **Customer Care Support** module. |

---

## ⚙️ How to Run (Local Setup)

### **Prerequisites**
- Node.js (v18+ recommended)  
- MongoDB or Atlas  
- Internet connection (for APIs like Cloudinary, Maps, etc.)

### **Steps**
1. **Clone the repository**
   ```bash
   git clone <repo-link>
   cd hotel-management-system
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Set environment variables in `.env`**
   ```
   DB_URL=<your_mongodb_connection_string>
   CLOUDINARY_URL=<your_cloudinary_key>
   SESSION_SECRET=<any_secret>
   ```
4. **Start the application**
   ```bash
   npm start
   ```
5. **Open in browser**
   ```
   http://localhost:3000
   ```

---

## 🧩 Key Files & Functions

| Area | File | Functionality |
|------|------|----------------|
| **Validation** | `/public/js/validation.js` | Client-side input validation (forms, login, signup) |
| **Dynamic UI** | `/views/*.ejs` | Displays real-time updates with EJS templating |
| **API Routes** | `/routes/*.js` | Handles CRUD operations and async data flow |
| **Controllers** | `/controllers/*.js` | Business logic for hotels, bookings, users, admin |
| **Database** | `/models/*.js` | Mongoose models for users, hotels, rooms, payments |
| **Async Handling** | `axios` / `fetch` in frontend | Demonstrates 3 async flows with Network tab evidence |

---

## 🔁 Async Data Handling Demos (Three Flows)

| Flow | Description | Network Evidence |
|------|--------------|------------------|
| **Flow 1:** User Booking | Async POST to create booking, DB insert verified | `/network_evidence/booking.png` |
| **Flow 2:** Admin Approvals | Async PATCH to approve hotel listing | `/network_evidence/admin_approve.png` |
| **Flow 3:** Payment Confirmation | Async POST via AJAX for payments | `/network_evidence/payment.png` |

---

## 🧪 Testing & Validation

Refer to [`test_plan.md`](./test_plan.md) for complete **validation and async test results**.  
All main flows were validated using manual and async API checks, and **Network tab** screenshots were taken during the demo.

---

## 🎥 Demo & Evidence

**Demo Video Link:**  
> https://drive.google.com/file/d/1namKrLQTXBCOh850w_j_gbq6DxfsblGi/view?usp=drive_link

**Exact Timestamps:**  
              Intro : 0:00 – 0:51
              Form validation : 0:52 – 2:06
              Dynamic HTML : 2:07 – 3:37
              Async Data Handling : 3:38 – 4:29
              Per member contribution : 4:30 – 6:00
              Wrap : 6:01 – 7:25

**Evidence Locations:**  
```
/network_evidence/     → Screenshots or recordings showing async requests  
/git-logs.txt          → Filtered commits per student  
/test_plan.md          → Validation & async test results  
```

---

## ✅ Summary
This project demonstrates:
- End-to-end **asynchronous data handling** in Node.js + EJS  
- Complete **role-based system** (Traveler, Owner, Admin)  
- Modular architecture with **Express**, **Mongoose**, and **Cloudinary**  
- Real-time updates verified using the **Network tab**
