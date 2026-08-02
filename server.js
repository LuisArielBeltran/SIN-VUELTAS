const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send("📍 ¡Jaque mate! El servidor de Sin Vueltas está online desde la carpeta correcta.");
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
