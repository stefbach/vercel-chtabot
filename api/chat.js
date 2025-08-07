// api/chat.js - API TIBOK Améliorée avec Sécurité et Cache
import OpenAI from 'openai';

// Configuration OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Cache en mémoire simple (remplacer par Redis en production)
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting en mémoire (remplacer par Redis en production)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

// Prompt système amélioré et structuré
const SYSTEM_PROMPTS = {
    fr: `Tu es l'assistant virtuel officiel de TIBOK, le service de téléconsultation médicale de l'île Maurice.

CONTEXTE DU SERVICE:
- Disponibilité: 8h00 - Minuit, 7j/7
- Tarif unique: Rs 1,150 (tout compris)
- Inclus: Consultation + Ordonnance + Livraison gratuite
- Temps moyen: 15 minutes pour consultation complète
- Zone de service: Toute l'île Maurice
- Médecins: Certifiés et enregistrés au Medical Council of Mauritius

RÈGLES ABSOLUES - JAMAIS À ENFREINDRE:
1. ❌ JAMAIS de diagnostic médical direct
2. ❌ JAMAIS de prescription de médicaments spécifiques
3. ❌ JAMAIS de conseil médical qui pourrait remplacer une consultation
4. ⚠️ URGENCES: Toujours rediriger vers "Appelez le 114 (SAMU) IMMÉDIATEMENT!"
5. ✅ Pour symptômes: "Je comprends vos symptômes. Nos médecins peuvent vous examiner maintenant."

RÉPONSES SELON LE CONTEXTE:
- Symptômes médicaux → Empathie + Proposition de consultation
- Questions sur le prix → Rs 1,150 tout inclus + avantages
- Questions sur le processus → Expliquer les 3 étapes simples
- Urgence détectée → Message d'alerte immédiat

COMPORTEMENT:
- Utiliser le vouvoiement
- Réponses courtes et claires (max 3 phrases)
- Ton empathique et professionnel
- Toujours orienter vers la consultation pour questions médicales
- Utiliser des émojis avec parcimonie (1-2 max par réponse)

PROCESSUS EN 3 ÉTAPES:
1. Paiement sécurisé (Rs 1,150)
2. Connexion immédiate avec médecin certifié
3. Réception ordonnance + livraison gratuite

AVANTAGES À MENTIONNER:
- Pas besoin de se déplacer
- Éviter les salles d'attente
- Confidentialité garantie
- Médecins expérimentés
- Médicaments livrés à domicile`,

    en: `You are TIBOK's official virtual assistant, the telemedicine service for Mauritius.

SERVICE CONTEXT:
- Availability: 8am - Midnight, 7 days/week
- Single rate: Rs 1,150 (all inclusive)
- Includes: Consultation + Prescription + Free delivery
- Average time: 15 minutes for complete consultation
- Service area: All of Mauritius
- Doctors: Certified and registered with Medical Council of Mauritius

ABSOLUTE RULES - NEVER TO BREAK:
1. ❌ NEVER provide direct medical diagnosis
2. ❌ NEVER prescribe specific medications
3. ❌ NEVER give medical advice that could replace consultation
4. ⚠️ EMERGENCIES: Always redirect to "Call 114 (SAMU) IMMEDIATELY!"
5. ✅ For symptoms: "I understand your symptoms. Our doctors can examine you now."

CONTEXTUAL RESPONSES:
- Medical symptoms → Empathy + Consultation proposal
- Price questions → Rs 1,150 all inclusive + benefits
- Process questions → Explain 3 simple steps
- Emergency detected → Immediate alert message

BEHAVIOR:
- Use formal address
- Short, clear responses (max 3 sentences)
- Empathetic and professional tone
- Always direct to consultation for medical questions
- Use emojis sparingly (1-2 max per response)

3-STEP PROCESS:
1. Secure payment (Rs 1,150)
2. Immediate connection with certified doctor
3. Receive prescription + free delivery

BENEFITS TO MENTION:
- No need to travel
- Avoid waiting rooms
- Guaranteed confidentiality
- Experienced doctors
- Medications delivered to home`,

    cr: `Ou lassistan virtuel ofisiel TIBOK, servis telekonsiltasion medikal Moris.

KONTEKS SERVIS:
- Disponibilite: 8er - Minwi, 7 zour lor 7
- Pri inik: Rs 1,150 (tou kompri)
- Inklir: Konsiltasion + Lordonans + Livrezon gratis
- Letan moyen: 15 minit pou konsiltasion komplet
- Zon servis: Tou Moris
- Dokter: Sertifie ek anrezistre dan Medical Council of Mauritius

REG ABSOLI - ZAME KASE:
1. ❌ ZAME donn diagnoze medikal direk
2. ❌ ZAME preskrir medikaman spesifik
3. ❌ ZAME donn konsey medikal ki kav ranplas konsiltasion
4. ⚠️ IRZAN: Touzour reorient ver "Apel 114 (SAMU) TOUSIT!"
5. ✅ Pou simtom: "Mo konpran ou simtom. Nou dokter kav egzamin ou aster."

REPONS SELON KONTEKS:
- Simtom medikal → Anpati + Propoz konsiltasion
- Kestion lor pri → Rs 1,150 tou kompri + avantaz
- Kestion lor prose → Explik 3 etap senp
- Irzan detekte → Mesaz alert tousit

KONPORTMAN:
- Servi langaz respektie
- Repons kourt ek kler (max 3 fraz)
- Ton anpatik ek profesionel
- Touzour orient ver konsiltasion pou kestion medikal
- Servi emoji avek modere (1-2 max par repons)

PROSE AN 3 ETAP:
1. Peman sekir (Rs 1,150)
2. Koneksion tousit ar dokter sertifie
3. Resevwar lordonans + livrezon gratis

AVANTAZ POU MANSIONE:
- Pa bizin deplase
- Evit sal latan
- Konfidansialite garanti
- Dokter eksperyante
- Medikaman livre lakaz`
};

// Validation et nettoyage des entrées
function validateAndSanitizeInput(body) {
    const { message, language = 'fr', conversationHistory = [], userProfile = {}, intent } = body;
    
    // Validation du message
    if (!message || typeof message !== 'string') {
        throw new Error('Message invalide');
    }
    
    const cleanMessage = message.trim().substring(0, 1000); // Limite à 1000 caractères
    
    // Validation de la langue
    const validLanguages = ['fr', 'en', 'cr'];
    const cleanLanguage = validLanguages.includes(language) ? language : 'fr';
    
    // Validation de l'historique
    const cleanHistory = Array.isArray(conversationHistory) 
        ? conversationHistory.slice(-20).filter(msg => 
            msg.role && msg.content && 
            ['user', 'assistant'].includes(msg.role) &&
            typeof msg.content === 'string'
          )
        : [];
    
    return {
        message: cleanMessage,
        language: cleanLanguage,
        conversationHistory: cleanHistory,
        userProfile: userProfile || {},
        intent: intent || 'general'
    };
}

// Vérification du rate limiting
function checkRateLimit(ip) {
    const now = Date.now();
    const userRateData = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    
    // Nettoyer les anciennes entrées
    if (now > userRateData.resetTime) {
        userRateData.count = 0;
        userRateData.resetTime = now + RATE_LIMIT_WINDOW;
    }
    
    if (userRateData.count >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }
    
    userRateData.count++;
    rateLimitMap.set(ip, userRateData);
    
    // Nettoyer le cache périodiquement
    if (rateLimitMap.size > 1000) {
        const oldestAllowed = now - RATE_LIMIT_WINDOW;
        for (const [key, value] of rateLimitMap.entries()) {
            if (value.resetTime < oldestAllowed) {
                rateLimitMap.delete(key);
            }
        }
    }
    
    return true;
}

// Détection d'urgence améliorée
function detectEmergency(message) {
    const emergencyPatterns = [
        // Français
        /\b(urgence|urgent|grave|suicide|mourir|mort)\b/i,
        /\b(douleur intense|mal intense|très mal)\b/i,
        /\b(ne (peux|peut) plus respirer|difficultés? respiratoires?)\b/i,
        /\b(saigne beaucoup|hémorragie|perte de sang)\b/i,
        /\b(inconscient|évanoui|coma)\b/i,
        /\b(crise cardiaque|infarctus|avc|accident vasculaire)\b/i,
        
        // English
        /\b(emergency|urgent|severe|suicide|dying|death)\b/i,
        /\b(intense pain|severe pain|extreme pain)\b/i,
        /\b(can'?t breathe|difficulty breathing|respiratory distress)\b/i,
        /\b(bleeding heavily|hemorrhage|blood loss)\b/i,
        /\b(unconscious|fainted|coma)\b/i,
        /\b(heart attack|stroke|cardiac arrest)\b/i,
        
        // Créole
        /\b(irzan|irzan|grav|swisid|mor|lanmor)\b/i,
        /\b(doule for|mal for|tro mal)\b/i,
        /\b(pa kav respire|difikilte respire)\b/i,
        /\b(seny boukou|perdi disan)\b/i,
        /\b(san konesans|tonbe|koma)\b/i,
        /\b(kriz kardiak|latak)\b/i
    ];
    
    return emergencyPatterns.some(pattern => pattern.test(message));
}

// Génération de réponse en cas d'erreur API
function getFallbackResponse(intent, language) {
    const fallbacks = {
        fr: {
            medical: "Je comprends que vous ne vous sentez pas bien. Nos médecins certifiés sont disponibles immédiatement pour vous examiner. La consultation coûte Rs 1,150, tout inclus.",
            pricing: "💰 Notre consultation coûte Rs 1,150, incluant l'examen médical, l'ordonnance et la livraison gratuite des médicaments. C'est un tarif unique tout compris !",
            process: "📱 C'est très simple : 1) Payez Rs 1,150, 2) Connectez-vous immédiatement avec un médecin, 3) Recevez votre ordonnance et vos médicaments. Total : 15 minutes !",
            general: "Je suis là pour vous aider avec vos questions de santé. Nos médecins sont disponibles de 8h à minuit. Comment puis-je vous assister ?"
        },
        en: {
            medical: "I understand you're not feeling well. Our certified doctors are immediately available to examine you. The consultation costs Rs 1,150, all inclusive.",
            pricing: "💰 Our consultation costs Rs 1,150, including medical examination, prescription and free medication delivery. It's a single all-inclusive rate!",
            process: "📱 It's very simple: 1) Pay Rs 1,150, 2) Connect immediately with a doctor, 3) Receive your prescription and medications. Total: 15 minutes!",
            general: "I'm here to help with your health questions. Our doctors are available from 8am to midnight. How can I assist you?"
        },
        cr: {
            medical: "Mo konpran ou pa pe santi ou bien. Nou dokter sertifie disponib tousit pou egzamin ou. Konsiltasion kout Rs 1,150, tou kompri.",
            pricing: "💰 Nou konsiltasion kout Rs 1,150, inklir egzamen medikal, lordonans ek livrezon medikaman gratis. Se enn pri inik tou kompri!",
            process: "📱 Li byen senp: 1) Pey Rs 1,150, 2) Konek tousit ar dokter, 3) Resevwar ou lordonans ek medikaman. Total: 15 minit!",
            general: "Mo la pou ed ou ar ou bann kestion sante. Nou dokter disponib depi 8er ziska minwi. Kouma mo kav asist ou?"
        }
    };
    
    return fallbacks[language]?.[intent] || fallbacks.fr.general;
}

// Handler principal
export default async function handler(req, res) {
    // CORS headers
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
    const origin = req.headers.origin;
    const allowedOrigin = allowedOrigins.includes('*') ? '*' : 
                         allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Vérifier la méthode
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false,
            error: 'Method not allowed' 
        });
    }

    // Obtenir l'IP pour le rate limiting
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.connection.remoteAddress || 
               'unknown';

    // Vérifier le rate limiting
    if (!checkRateLimit(ip)) {
        return res.status(429).json({
            success: false,
            error: 'Trop de requêtes. Veuillez patienter quelques instants.',
            retryAfter: 60
        });
    }

    try {
        // Valider et nettoyer les entrées
        const {
            message,
            language,
            conversationHistory,
            userProfile,
            intent
        } = validateAndSanitizeInput(req.body);

        // Détection d'urgence
        if (detectEmergency(message)) {
            const emergencyMessages = {
                fr: "🚨 URGENCE MÉDICALE DÉTECTÉE ! Appelez immédiatement le 114 (SAMU) ou rendez-vous aux urgences de l'hôpital le plus proche. Ne perdez pas de temps !",
                en: "🚨 MEDICAL EMERGENCY DETECTED! Call 114 (SAMU) immediately or go to the nearest hospital emergency room. Don't waste time!",
                cr: "🚨 IRZANS MEDIKAL DETEKTE! Apel 114 (SAMU) tousit oubien al lopital irzan pli pre. Pa perdi letan!"
            };
            
            return res.status(200).json({
                success: true,
                response: emergencyMessages[language],
                isEmergency: true
            });
        }

        // Vérifier le cache
        const cacheKey = `${language}-${intent}-${message.toLowerCase().substring(0, 50)}`;
        const cachedResponse = responseCache.get(cacheKey);
        
        if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
            return res.status(200).json({
                success: true,
                response: cachedResponse.response,
                cached: true
            });
        }

        // Construire les messages pour OpenAI
        const messages = [
            { 
                role: 'system', 
                content: SYSTEM_PROMPTS[language] 
            }
        ];

        // Ajouter l'historique de conversation (limité)
        conversationHistory.slice(-10).forEach(msg => {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        });

        // Ajouter le contexte utilisateur si pertinent
        if (userProfile.hasExpressedSymptoms) {
            messages.push({
                role: 'system',
                content: 'L\'utilisateur a exprimé des symptômes. Soyez particulièrement empathique et orientez vers la consultation.'
            });
        }

        // Ajouter le message actuel
        messages.push({ 
            role: 'user', 
            content: message 
        });

        console.log(`[TIBOK] Processing request - Lang: ${language}, Intent: ${intent}, Cache: ${!!cachedResponse}`);

        // Appel à OpenAI avec timeout et retry
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000); // 25 secondes

        try {
            const completion = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                messages: messages,
                temperature: 0.7,
                max_tokens: 200, // Réduit pour des réponses plus concises
                presence_penalty: 0.3,
                frequency_penalty: 0.3
            }, {
                signal: controller.signal
            });

            clearTimeout(timeout);

            const response = completion.choices[0].message.content;

            // Mettre en cache la réponse
            responseCache.set(cacheKey, {
                response,
                timestamp: Date.now()
            });

            // Nettoyer le cache si trop grand
            if (responseCache.size > 100) {
                const now = Date.now();
                for (const [key, value] of responseCache.entries()) {
                    if (now - value.timestamp > CACHE_TTL) {
                        responseCache.delete(key);
                    }
                }
            }

            res.status(200).json({
                success: true,
                response: response,
                intent: intent
            });

        } catch (openAIError) {
            clearTimeout(timeout);
            
            if (openAIError.name === 'AbortError') {
                console.error('[TIBOK] OpenAI timeout');
            } else {
                console.error('[TIBOK] OpenAI error:', openAIError.message);
            }
            
            // Utiliser une réponse de fallback
            const fallbackResponse = getFallbackResponse(intent, language);
            
            res.status(200).json({
                success: true,
                response: fallbackResponse,
                fallback: true
            });
        }

    } catch (error) {
        console.error('[TIBOK] Error:', error);
        
        res.status(400).json({
            success: false,
            error: 'Une erreur est survenue. Veuillez réessayer.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
