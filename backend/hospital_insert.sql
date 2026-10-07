INSERT INTO hospitals (
    id,
    name,
    latitude,
    longitude,
    address,
    "contactNumber",
    "totalBeds",
    "availableICUBeds",
    "availableEmergencyBeds",
    "availableVentilators",
    "traumaCenterLevel",
    "acceptingPatients",
    specialties,
    "lastCapacityUpdate"
)
VALUES (
    'HOSP-01',
    'Metro General Hospital',
    40.7128,
    -74.0060,
    '123 Health Sciences Boulevard, Metro City, NY 10001',
    '+1-555-019-2834',
    450,
    48,
    35,
    24,
    1,
    true,
    ARRAY[
        'Cardiology',
        'Neurology',
        'Oncology',
        'Orthopedics',
        'Pediatrics',
        'Emergency Medicine'
    ],
    NOW()
);