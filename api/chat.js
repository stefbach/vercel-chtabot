// api/chat.js - Vercel Function pour Tibok
import OpenAI from 'openai';

// Configuration OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Prompt système Tibok
const TIBOK_PROMPT = `Tu es l'assistant virtuel officiel de TIBOK, le service de téléconsultation médicale de l'île Maurice.

RÈGLES ABSOLUES:
1. JAMAIS de diagnostic ou conseil médical direct
2. Pour toute question médicale: "Nos médecins peuvent vous aider. Consultation à Rs 1,150"
3. En cas d'urgence: "URGENT: Appelez le 114 (SAMU) immédiatement!"
4. Reste dans le cadre du service Tibok

INFORMATIONS TIBOK:
- Prix: Rs 1,150 (tout inclus)
- Horaires: 8h-Minuit
- Livraison médicaments incluse
- Médecins certifiés Maurice`;

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, language = 'fr', conversationHistory = [] } = req.body;

        // Construire les messages pour OpenAI
        const messages = [
            { role: 'system', content: TIBOK_PROMPT }
        ];

        // Ajouter l'historique SEULEMENT s'il est valide
        if (conversationHistory && Array.isArray(conversationHistory)) {
            conversationHistory.slice(-5).forEach(msg => {
                // Vérifier que chaque message a role et content
                if (msg.role && msg.content) {
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    });
                }
            });
        }

        // Ajouter le message actuel
        messages.push({ role: 'user', content: message });

        console.log('Messages envoyés:', JSON.stringify(messages, null, 2));

        // Appel OpenAI
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messages,
            temperature: 0.7,
            max_tokens: 300
        });

        const response = completion.choices[0].message.content;

        res.status(200).json({
            success: true,
            response: response
        });

    } catch (error) {
        console.error('Erreur OpenAI:', error);
        res.status(500).json({
            success: false,
            error: 'Désolé, une erreur est survenue. Réessayez.',
            details: error.message
        });
    }
}
