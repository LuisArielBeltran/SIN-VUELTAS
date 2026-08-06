const getNearbyUsers = async (req, res) => {
    const userId = req.user.id;

    try {
        // Consultar ubicación, estado premium y fecha de expiración de prueba del usuario
        const userQuery = await db.query(
            'SELECT latitude, longitude, is_premium, trial_ends_at FROM users WHERE id = $1', 
            [userId]
        );
        
        if (userQuery.rows.length === 0 || userQuery.rows[0].latitude === null) {
            return res.status(400).json({ error: 'El usuario no tiene una ubicación registrada.' });
        }

        const { latitude: userLat, longitude: userLon, is_premium, trial_ends_at } = userQuery.rows[0];

        // EVALUACIÓN DE LA REGLA COMERCIAL:
        // Es 50km si pagó Premium O si la fecha actual es menor a la fecha de fin de prueba. Si no, 2km.
        const now = new Date();
        const isInTrial = trial_ends_at && new Date(trial_ends_at) > now;
        const radiusInKm = (is_premium || isInTrial) ? 50 : 2;

        const query = `
            SELECT id, username, profile_image, status, latitude, longitude, is_premium, is_verified, distance_km
            FROM (
                SELECT id, username, profile_image, status, latitude, longitude, is_premium, is_verified,
                    (6371 * acos(
                        cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + 
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

        const { rows } = await db.query(query, [userLat, userLon, userId, radiusInKm]);

        res.json({
            success: true,
            isTrialActive: isInTrial,
            radiusUsed: radiusInKm,
            count: rows.length,
            users: rows
        });
    } catch (error) {
        console.error('Error en el radar geográfico:', error);
        res.status(500).json({ error: 'Error al escanear el radar cercano.' });
    }
};
