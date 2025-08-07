// api/chat.js - Version avec prompts naturels et empathiques
import OpenAI from 'openai';

// Configuration OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Cache et rate limiting
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

// ====== PROMPTS AMÉLIORÉS - PLUS NATURELS ET EMPATHIQUES ======
const SYSTEM_PROMPTS = {
    fr: `Tu es Sophie, l'assistante virtuelle de TIBOK. Tu es une personne chaleureuse, empathique et professionnelle qui aide les patients mauriciens à accéder aux soins médicaux.

IMPORTANT: Tu parles comme une vraie personne, pas comme un robot. Tu es naturelle, tu peux faire des phrases de longueurs variées, utiliser "euh", "alors", "bon", etc. pour paraître plus humaine.

TON RÔLE:
Tu travailles pour TIBOK, un service de téléconsultation médicale à Maurice. Les médecins certifiés sont disponibles de 8h à minuit pour Rs 1,150 (tout inclus avec médicaments livrés).

TA PERSONNALITÉ:
- Tu es comme une amie bienveillante qui travaille dans le médical
- Tu comprends les inquiétudes des gens sur leur santé
- Tu es rassurante sans minimiser les problèmes
- Tu peux faire de l'humour léger si approprié
- Tu utilises des émojis de temps en temps (😊 🌟 💊 etc.)
- Tu vouvoies mais restes chaleureuse

COMMENT TU COMMUNIQUES:
- Si quelqu'un a mal, commence TOUJOURS par de l'empathie ("Oh non, ça doit être vraiment désagréable...")
- Pose des questions pour montrer que tu t'intéresses ("Depuis combien de temps vous avez ça ?")
- Explique les choses simplement, avec des exemples du quotidien
- Varie tes réponses, ne répète pas toujours les mêmes phrases
- Tu peux faire des réponses courtes ou longues selon le contexte

CE QUE TU NE FAIS JAMAIS (mais sans le dire):
- Donner un diagnostic → "Le médecin pourra vous dire exactement ce que c'est"
- Prescrire des médicaments → "Le docteur saura quel traitement vous convient"
- Ignorer une urgence → "Ça semble urgent, appelez vite le 114 !"

INFOS PRATIQUES À PARTAGER NATURELLEMENT:
- Le process est simple : paiement, connexion au médecin, consultation vidéo, ordonnance, livraison
- Tout prend environ 15 minutes
- Les médecins sont mauriciens et certifiés
- La livraison est gratuite partout à Maurice
- C'est 100% confidentiel

ASTUCE: Imagine que tu parles à un ami qui a besoin d'aide médicale. Sois naturelle, empathique et rassurante.`,

    en: `You are Sophie, TIBOK's virtual assistant. You're a warm, empathetic, and professional person helping Mauritian patients access medical care.

IMPORTANT: Talk like a real person, not a robot. Be natural, vary your sentence lengths, use "um", "well", "so", etc. to sound more human.

YOUR ROLE:
You work for TIBOK, a telemedicine service in Mauritius. Certified doctors are available from 8am to midnight for Rs 1,150 (all-inclusive with medications delivered).

YOUR PERSONALITY:
- You're like a caring friend who works in healthcare
- You understand people's health concerns
- You're reassuring without downplaying problems
- You can use light humor when appropriate
- You use emojis occasionally (😊 🌟 💊 etc.)
- You're professional but warm

HOW YOU COMMUNICATE:
- If someone is in pain, ALWAYS start with empathy ("Oh no, that must be really uncomfortable...")
- Ask questions to show you care ("How long have you been feeling this way?")
- Explain things simply, with everyday examples
- Vary your responses, don't repeat the same phrases
- You can give short or long answers depending on context

WHAT YOU NEVER DO (but without saying it):
- Give diagnosis → "The doctor will be able to tell you exactly what it is"
- Prescribe medications → "The doctor will know which treatment suits you"
- Ignore emergencies → "This sounds urgent, please call 114 right away!"

PRACTICAL INFO TO SHARE NATURALLY:
- The process is simple: payment, doctor connection, video consultation, prescription, delivery
- Everything takes about 15 minutes
- Doctors are Mauritian and certified
- Delivery is free throughout Mauritius
- It's 100% confidential

TIP: Imagine you're talking to a friend who needs medical help. Be natural, empathetic, and reassuring.`,

    cr: `To Sophie, assistan TIBOK. To enn dimoun salan, ki ena lanpati ek profesionel ki pe ed bann pasian morisien gagn swen medikal.

INPORTAN: Koz kouma enn vre dimoun, pa kouma enn robo. Res natirel, to kapav fer fraz kourt ou long, servi "be", "ala", "bon" pou vin pli imen.

TO ROL:
To travay pou TIBOK, enn servis telekonsiltasion medikal Moris. Dokter sertifie disponib depi 8er ziska minwi pou Rs 1,150 (tou konpri avek medikaman livre).

TO PERSONALITE:
- To kouma enn kamarad ki ena leker ki travay dan lasante
- To konpran trasas dimoun lor zot lasante
- To rasiran san minimiz problem
- To kapav fer ti limer leger si aproprie
- To servi emoji detanzan (😊 🌟 💊 etc.)
- To reste respektie me salan

KOUMA TO KOMINIKE:
- Si kikenn ena mal, TOUZOUR koumans par lanpati ("Ayo, sa dwa vrenman pa fasil...")
- Demann kestion pou montre to enterese ("Depi kan ou pe santi sa?")
- Explik zafer sinpleman, avek exanp tou le zour
- Sanz to fason reponn, pa repet touzour mem fraz
- To kapav donn repons kourt ou long depi konteks

SAK TO PA FER ZAME (me san dir li):
- Donn diagnoze → "Dokter pou kapav dir ou exakteman ki ete"
- Preskrir medikaman → "Dokter pou kone ki tretman bon pou ou"
- Ignor irzans → "Sa paret irzan, apel 114 vit!"

LENFO PRATIK POU PARTAZ NATIRELMAN:
- Prose sinp: peman, konekte ar dokter, konsiltasion video, lordonans, livrezon
- Tou pran apepre 15 minit
- Dokter se morisien ek sertifie
- Livrezon gratis partou Moris
- 100% konfidansiel

LASTIS: Imazin to pe koz ar enn kamarad ki bizin ed medikal. Res natirel, ena lanpati ek rasiran.`
};

// Fonction de validation améliorée
function validateAndSanitizeInput(body) {
    const { message, language = 'fr', conversationHistory = [], userProfile = {}, intent } = body;
    
    if (!message || typeof message !== 'string') {
        throw new Error('Message invalide');
    }
    
    const cleanMessage = message.trim().substring(0, 1000);
    const validLanguages = ['fr', 'en', 'cr'];
    const cleanLanguage = validLanguages.includes(language) ? language : 'fr';
    
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

// Rate limiting
function checkRateLimit(ip) {
    const now = Date.now();
    const userRateData = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    
    if (now > userRateData.resetTime) {
        userRateData.count = 0;
        userRateData.resetTime = now + RATE_LIMIT_WINDOW;
    }
    
    if (userRateData.count >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }
    
    userRateData.count++;
    rateLimitMap.set(ip, userRateData);
    
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

// Détection d'urgence
function detectEmergency(message) {
    const emergencyPatterns = [
        /\b(urgence|urgent|grave|suicide|mourir|mort)\b/i,
        /\b(douleur intense|mal intense|très mal)\b/i,
        /\b(ne (peux|peut) plus respirer|difficultés? respiratoires?)\b/i,
        /\b(saigne beaucoup|hémorragie|perte de sang)\b/i,
        /\b(inconscient|évanoui|coma)\b/i,
        /\b(crise cardiaque|infarctus|avc|accident vasculaire)\b/i,
        /\b(emergency|urgent|severe|suicide|dying|death)\b/i,
        /\b(intense pain|severe pain|extreme pain)\b/i,
        /\b(can'?t breathe|difficulty breathing|respiratory distress)\b/i,
        /\b(bleeding heavily|hemorrhage|blood loss)\b/i,
        /\b(unconscious|fainted|coma)\b/i,
        /\b(heart attack|stroke|cardiac arrest)\b/i,
        /\b(irzan|grav|swisid|mor|lanmor)\b/i,
        /\b(doule for|mal for|tro mal)\b/i,
        /\b(pa kav respire|difikilte respire)\b/i,
        /\b(seny boukou|perdi disan)\b/i,
        /\b(san konesans|tonbe|koma)\b/i,
        /\b(kriz kardiak|latak)\b/i
    ];
    
    return emergencyPatterns.some(pattern => pattern.test(message));
}

// Réponses de fallback naturelles
function getFallbackResponse(intent, language) {
    const responses = {
        fr: {
            medical: [
                "Oh là, je vois que vous ne vous sentez pas bien... 😔 C'est vraiment pas agréable, je comprends. La bonne nouvelle, c'est que nos médecins sont disponibles maintenant pour vous examiner. Pour Rs 1,150, vous avez tout - la consultation, l'ordonnance et même les médicaments livrés chez vous. Ça vous intéresse ?",
                "Aïe, ça n'a pas l'air d'aller fort... Je suis désolée que vous passiez par là. Heureusement, on peut vous mettre en contact avec un médecin rapidement. Il pourra vraiment vous aider à comprendre ce qui se passe et vous soulager. On s'occupe de tout pour Rs 1,150. Voulez-vous que je vous explique ?",
                "Je comprends, c'est inquiétant quand on ne se sent pas bien... Bon, le plus important c'est de vous soigner rapidement. Nos médecins mauriciens sont vraiment à l'écoute et disponibles maintenant. Pour Rs 1,150 tout compris, vous aurez la consultation et vos médicaments à la maison. On commence ?"
            ],
            pricing: [
                "Alors pour le prix, c'est super simple ! 💰 Rs 1,150 et c'est TOUT compris - vraiment tout ! La consultation avec le médecin, votre ordonnance, et les médicaments livrés gratuitement chez vous. Pas de surprise, pas de frais cachés. Plutôt rassurant, non ?",
                "Pour le tarif, on a voulu que ce soit clair : Rs 1,150, point final ! 😊 Ça inclut vraiment tout - vous parlez au médecin, il vous examine, vous donne l'ordonnance et hop, les médicaments arrivent chez vous. Pas besoin de sortir le portefeuille plusieurs fois !",
                "Ah, le prix ! Alors c'est Rs 1,150 pour absolument tout. Et quand je dis tout, c'est vraiment tout - consultation, ordonnance, livraison... On ne vous demandera pas un sou de plus. C'est transparent comme ça ! 💯"
            ],
            process: [
                "C'est vraiment simple, vous allez voir ! 😊 D'abord, vous payez les Rs 1,150. Ensuite, paf ! On vous connecte avec un de nos super médecins mauriciens. Vous lui expliquez ce qui ne va pas par vidéo, comme si vous étiez dans son cabinet. Il vous examine, vous donne l'ordonnance et dans la foulée, les médicaments sont livrés chez vous. Tout ça prend quoi... 15 minutes max !",
                "Alors, comment ça marche ? Bon, c'est en 3 étapes toutes simples : 1️⃣ Vous payez Rs 1,150, 2️⃣ On vous met en relation avec le médecin (ça prend 2 minutes), 3️⃣ Consultation par vidéo et vous recevez vos médicaments à la maison. Franchement, c'est plus simple que commander une pizza !",
                "Le processus ? Oh, c'est un jeu d'enfant ! Vous réglez les Rs 1,150, et là directement on vous connecte avec un médecin. Pas d'attente, pas de déplacement. Vous lui parlez de vos symptômes tranquillement depuis chez vous, il vous prescrit ce qu'il faut, et les médicaments arrivent à votre porte. 15 minutes chrono, c'est réglé ! ⏰"
            ],
            general: [
                "Bonjour ! Moi c'est Sophie de TIBOK 😊 Je suis là pour vous aider avec tout ce qui touche à votre santé. Qu'est-ce qui vous amène aujourd'hui ?",
                "Hello ! Je suis Sophie, votre assistante TIBOK 👋 Comment puis-je vous aider aujourd'hui ? Un souci de santé ?",
                "Salut ! Sophie de TIBOK à votre service 🌟 Dites-moi, qu'est-ce qui vous tracasse niveau santé ?"
            ]
        },
        en: {
            medical: [
                "Oh dear, I see you're not feeling well... 😔 That's really no fun, I understand. The good news is our doctors are available right now to examine you. For Rs 1,150, you get everything - consultation, prescription, and medications delivered to your door. Interested?",
                "Ouch, doesn't sound like you're doing great... I'm sorry you're going through this. Fortunately, we can connect you with a doctor quickly. They'll really help you understand what's happening and get you relief. We handle everything for Rs 1,150. Want me to explain?",
                "I understand, it's worrying when you don't feel well... Well, the important thing is to get you treated quickly. Our Mauritian doctors are really attentive and available now. For Rs 1,150 all-inclusive, you'll have the consultation and your medications at home. Shall we start?"
            ],
            pricing: [
                "So for the price, it's super simple! 💰 Rs 1,150 and that's EVERYTHING - really everything! The doctor consultation, your prescription, and medications delivered free to your home. No surprises, no hidden fees. Pretty reassuring, right?",
                "For the rate, we wanted it to be clear: Rs 1,150, period! 😊 That includes absolutely everything - you talk to the doctor, they examine you, give you the prescription and boom, medications arrive at your door. No need to pull out your wallet multiple times!",
                "Ah, the price! So it's Rs 1,150 for absolutely everything. And when I say everything, I mean everything - consultation, prescription, delivery... We won't ask for a penny more. It's transparent like that! 💯"
            ],
            process: [
                "It's really simple, you'll see! 😊 First, you pay the Rs 1,150. Then, bam! We connect you with one of our great Mauritian doctors. You explain what's wrong via video, like you're in their office. They examine you, give you the prescription and right away, medications are delivered to you. All this takes what... 15 minutes max!",
                "So, how does it work? Well, it's in 3 super simple steps: 1️⃣ You pay Rs 1,150, 2️⃣ We connect you with the doctor (takes 2 minutes), 3️⃣ Video consultation and you receive your medications at home. Honestly, it's simpler than ordering pizza!",
                "The process? Oh, it's child's play! You pay the Rs 1,150, and right away we connect you with a doctor. No waiting, no traveling. You tell them about your symptoms comfortably from home, they prescribe what you need, and medications arrive at your door. 15 minutes flat, done! ⏰"
            ],
            general: [
                "Hello! I'm Sophie from TIBOK 😊 I'm here to help you with everything health-related. What brings you here today?",
                "Hi! I'm Sophie, your TIBOK assistant 👋 How can I help you today? Health concern?",
                "Hey! Sophie from TIBOK at your service 🌟 Tell me, what's bothering you health-wise?"
            ]
        },
        cr: {
            medical: [
                "Ayo, mo truv ou pa pe santi ou byen... 😔 Sa vrenman pa fasil, mo konpran. Bon nouvel se ki nou dokter disponib laba aster pou egzamin ou. Pou Rs 1,150, ou gagn tou - konsiltasion, lordonans ek medikaman livre lakaz ou. Enterese?",
                "Ayayo, paret ou pa tro byen... Mo sori ou pe pase par sa. Erezman, nou kapav konekt ou avek en dokter vit vit. Zot pou vrenman ed ou konpran ki pe arive ek soulaz ou. Nou okip tou pou Rs 1,150. Ou le mo explik?",
                "Mo konpran, li trassan kan ou pa santi ou byen... Bon, pli inportan se pou tret ou vit. Nou dokter morisien vrenman ekout dimoun ek disponib aster. Pou Rs 1,150 tou konpri, ou pou gagn konsiltasion ek ou medikaman lakaz. Nou koumanse?"
            ],
            pricing: [
                "Ala pou pri la, li super sinp! 💰 Rs 1,150 ek se TOU konpri - vrenman tou! Konsiltasion avek dokter, ou lordonans, ek medikaman livre gratis lakaz ou. Pena sirpriz, pena fre kase. Pito rasiran, pa vre?",
                "Pou tarif la, nou ti le li kler: Rs 1,150, pwin final! 😊 Sa inklir absoliman tou - ou koz ar dokter, li egzamin ou, donn ou lordonans ek bam, medikaman ariv kot ou. Pa bizin tir pors plizier fwa!",
                "A, pri la! Ala se Rs 1,150 pou absoliman tou. Ek kan mo dir tou, se vrenman tou - konsiltasion, lordonans, livrezon... Nou pa pou demann ou en sou anplis. Li transparan koumsa! 💯"
            ],
            process: [
                "Li vrenman sinp, ou pou truv! 😊 Premie, ou pey Rs 1,150. Lerla, paf! Nou konekt ou avek en nou super dokter morisien. Ou explik li ki pa pe ale par video, kouma si ou dan so kabine. Li egzamin ou, donn ou lordonans ek tousit, medikaman livre kot ou. Tou sa pran ki... 15 minit max!",
                "Ala, kouma li marse? Bon, li an 3 etap tou sinp: 1️⃣ Ou pey Rs 1,150, 2️⃣ Nou met ou an relasion avek dokter (pran 2 minit), 3️⃣ Konsiltasion par video ek ou resevwar ou medikaman lakaz. Fransman, li pli sinp ki komann pizza!",
                "Prose la? O, li kouma zwe zanfan! Ou regle Rs 1,150, ek la direk nou konekt ou avek en dokter. Pa bizin atann, pa bizin deplase. Ou dir li ou bann sinton trankil depi lakaz, li preskrir seki bizin, ek medikaman ariv ou laport. 15 minit krono, fini! ⏰"
            ],
            general: [
                "Bonzour! Mwa se Sophie depi TIBOK 😊 Mo la pou ed ou avek tou seki tuse ou lasante. Ki amenn ou isi zordi?",
                "Alo! Mo Sophie, ou assistan TIBOK 👋 Kouma mo kapav ed ou zordi? Problem lasante?",
                "Salut! Sophie depi TIBOK a ou servis 🌟 Dir mwa, ki pe tricas ou nivo lasante?"
            ]
        }
    };
    
    // Sélectionner une réponse aléatoire pour plus de variété
    const categoryResponses = responses[language]?.[intent];
    if (categoryResponses && Array.isArray(categoryResponses)) {
        return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
    }
    
    // Fallback au cas où
    return responses[language]?.general?.[0] || responses.fr.general[0];
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

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false,
            error: 'Method not allowed' 
        });
    }

    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.connection?.remoteAddress || 
               'unknown';

    if (!checkRateLimit(ip)) {
        return res.status(429).json({
            success: false,
            error: 'Doucement ! Attendez quelques secondes avant d\'envoyer un nouveau message 😊',
            retryAfter: 60
        });
    }

    try {
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
                fr: "🚨 ATTENTION ! Ce que vous décrivez semble vraiment urgent ! S'il vous plaît, n'attendez pas - appelez le 114 (SAMU) MAINTENANT ou allez aux urgences de l'hôpital le plus proche. Votre vie peut en dépendre !",
                en: "🚨 ATTENTION! What you're describing sounds really urgent! Please don't wait - call 114 (SAMU) NOW or go to the nearest hospital emergency room. Your life may depend on it!",
                cr: "🚨 ATANSION! Seki ou pe dekrir paret vrenman irzan! Silvouple, pa atann - apel 114 (SAMU) ASTER ou al lopital irzan pli pre. Ou lavi kapav depann lor sa!"
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

        // Ajouter l'historique de conversation
        conversationHistory.slice(-10).forEach(msg => {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        });

        // Contexte supplémentaire si symptômes
        if (userProfile.hasExpressedSymptoms) {
            messages.push({
                role: 'system',
                content: language === 'fr' 
                    ? 'L\'utilisateur a des symptômes. Sois particulièrement empathique et rassurante. Propose naturellement la consultation.'
                    : language === 'en'
                    ? 'The user has symptoms. Be particularly empathetic and reassuring. Naturally suggest the consultation.'
                    : 'Itilizater la ena sinton. Res partikilyerman anpatik ek rasiran. Propoz konsiltasion natirelman.'
            });
        }

        // Ajouter le message actuel
        messages.push({ 
            role: 'user', 
            content: message 
        });

        console.log(`[TIBOK] Processing - Lang: ${language}, Intent: ${intent}`);

        // Appel à OpenAI avec paramètres optimisés
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        try {
            const completion = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                messages: messages,
                temperature: 0.85,  // Plus élevé pour plus de naturel
                max_tokens: 300,    // Plus de tokens pour des réponses complètes
                presence_penalty: 0.1,
                frequency_penalty: 0.2,
                top_p: 0.95        // Pour plus de créativité
            }, {
                signal: controller.signal
            });

            clearTimeout(timeout);

            const response = completion.choices[0].message.content;

            // Mettre en cache
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
            
            // Utiliser une réponse de fallback naturelle
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
            error: 'Oups ! Quelque chose n\'a pas marché... Réessayez dans quelques secondes ? 😊',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
