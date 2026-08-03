const db = require('../config/db');

// Función auxiliar para agregar ruido de privacidad (aprox 100 a 200 metros)
const addPrivacyNoise = (lat, lon) => {
    const offset = 0.0012; // Radio de desfase controlado (~150 metros)
    const randomLat = (Math.random() - 0.5) * offset;
    const randomLon = (Math.random() - 0.5) * offset;
    return {
        lat: lat + randomLat,
        lon: lon + randomLon
    };
};

// 1. Actualizar ubicación del usuario con ruido
const updateLocation = async (req, res) => {
    const userId = req.user.id;
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitud y longitud son requeridas.' });
    }

    try {
        const noisyCoords = addPrivacyNoise(latitude, longitude);

        const query = `
            UPDATE users 
            SET latitude = $1,
                longitude = $2,
                last_location_update = NOW()
            WHERE id = $3
            RETURNING id, last_location_update;
        `;
        
        await db.query(query, [noisyCoords.lat, noisyCoords.lon, userId]);

        res.json({ 
            success: true, 
            message: 'Ubicación actualizada con éxito bajo parámetros de privacidad.' 
        });
    } catch (error) {
        console.error('Error al actualizar ubicación:', error);
        res.status(500).json({ error: 'Error interno del servidor al procesar la ubicación.' });
    }
};

// 2. Buscar usuarios cercanos en el radar usando la fórmula de Haversine en SQL puro
const getNearbyUsers = async (req, res) => {
    const userId = req.user.id;
    const { radiusInKm = 5 } = req.query; // Radio por defecto: 5 km

    try {
        // Primero obtenemos la ubicación del usuario actual
        const userQuery = await db.query('SELECT latitude, longitude FROM users WHERE id = $1', [userId]);
        
        if (userQuery.rows.length === 0 || userQuery.rows[0].latitude === null) {
            return res.status(400).json({ error: 'El usuario no tiene una ubicación registrada.' });
        }

        const userLat = userQuery.rows[0].latitude;
        const userLon = userQuery.rows[0].longitude;

        // Consulta usando Haversine (Radio de la Tierra = 6371 km)
        const query = `
            SELECT id, username, profile_image, latitude, longitude, distance_km
            FROM (
                SELECT id, username, profile_image, latitude, longitude,
                    (6371 * acos(
                        cos(radians($1)) * cos(radians(latitude)) * 
                        cos(radians(longitude) - radians($2)) + 
                        sin(radians($1)) * sin(radians(latitude))
                    )) AS distance_km
                FROM users
                WHERE id != $3
                  AND latitude IS NOT NULL 
                  AND longitude IS NOT NULL
                  AND last_location_update >= NOW() - INTERVAL '24 hours'
            ) sub
            WHERE distance_km <= $4
            ORDER BY distance_km ASC;
        `;

        const { rows } = await db.query(query, [userLat, userLon, userId, parseFloat(radiusInKm)]);

        res.json({
            success: true,
            count: rows.length,
            users: rows
        });
    } catch (error) {
        console.error('Error en el radar geográfico:', error);
        res.status(500).json({ error: 'Error al escanear el radar cercano.' });
    }
};

module.exports = {
    updateLocation,
    getNearbyUsers
};