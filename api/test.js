export default function handler(req, res) {
    res.status(200).json({
        message: 'Vercel functions are working',
        nodeVersion: process.version,
        env: process.env.VERCEL ? 'vercel' : 'local'
    });
}
