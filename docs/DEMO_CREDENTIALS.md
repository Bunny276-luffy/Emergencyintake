# Emergency AI Platform - Demo Accounts

**IMPORTANT:** These credentials are for local development and project demonstration purposes only. They must not be deployed to a production environment.

The backend authorization mechanism validates the roles based on the JWT generated for these specific IDs.

### Admin
- **Role:** ADMIN
- **ID:** `ADMIN-001`
- **Password:** `admin123`

### Dispatch Center
- **Role:** DISPATCHER
- **ID:** `DISP-001`
- **Password:** `dispatch123`

### Ambulance Driver
- **Role:** AMBULANCE_DRIVER
- **ID:** `AMB-001`
- **Password:** `amb123`
- *Note:* Driver can only update location and workflow state for `AMB-001`.

### Paramedic
- **Role:** PARAMEDIC
- **ID:** `PARA-001`
- **Password:** `para123`
- *Note:* Has permission to submit clinical reports and use Gemini structuring.

### Hospital ER
- **Role:** HOSPITAL
- **ID:** `HOSP-001`
- **Password:** `hosp123`
- *Note:* Views incoming emergencies and manages bed reservations only for `HOSP-001`.
