import { Router } from 'express'
const router = Router()

// Navidrome integration removed — routes intentionally disabled
router.use((req, res) => res.status(410).json({ message: 'Navidrome integration removed' }))

export default router

