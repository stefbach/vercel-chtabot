// api/health.js - Endpoint de santé pour monitoring
import OpenAI from 'openai';

// Version de l'API
const API_VERSION = '2.0.0';
const DEPLOYMENT_DATE = process.env.VERCEL_GIT_COMMIT_SHA || 'local';

// Vérifier la connexion OpenAI
async function checkOpenAI() {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Test simple avec timeout court
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    await openai.models.retrieve('gpt-3.5-turbo', {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return { status: 'healthy', latency: Date.now() };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error.message?.substring(0, 50) || 'Connection failed'
    };
  }
}

// Vérifier Redis si configuré
async function checkRedis() {
  if (!process.env.REDIS_URL) {
    return { status: 'not_configured' };
  }

  try {
    // Ici vous ajouteriez la vérification Redis
    // Pour l'instant, on retourne juste le statut
    return { status: 'not_implemented' };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error.message?.substring(0, 50) 
    };
  }
}

// Calculer l'utilisation mémoire
function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    rss: Math.round(used.rss / 1024 / 1024), // MB
    heapTotal: Math.round(used.heapTotal / 1024 / 1024), // MB
    heapUsed: Math.round(used.heapUsed / 1024 / 1024), // MB
    external: Math.round(used.external / 1024 / 1024), // MB
  };
}

// Handler principal
export default async function handler(req, res) {
  // Headers de sécurité basiques
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Vérifier la méthode
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowed: ['GET', 'HEAD']
    });
  }

  // Mode simple (pour load balancers)
  if (req.query.simple === 'true') {
    return res.status(200).send('OK');
  }

  try {
    const startTime = Date.now();

    // Collecter les informations de santé
    const health = {
      status: 'healthy',
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      deployment: DEPLOYMENT_DATE.substring(0, 7),
      environment: process.env.NODE_ENV || 'development',
      region: process.env.VERCEL_REGION || 'unknown',
      uptime: process.uptime(),
      memory: getMemoryUsage(),
      checks: {},
    };

    // Vérifications détaillées (seulement si demandé)
    if (req.query.detailed === 'true') {
      // Vérifier OpenAI (avec timeout)
      const openAICheck = await Promise.race([
        checkOpenAI(),
        new Promise(resolve => 
          setTimeout(() => resolve({ status: 'timeout' }), 5000)
        ),
      ]);
      
      health.checks.openai = openAICheck;

      // Vérifier Redis si configuré
      health.checks.redis = await checkRedis();

      // Vérifier les variables d'environnement critiques
      health.checks.config = {
        openai_key: !!process.env.OPENAI_API_KEY,
        allowed_origins: !!process.env.ALLOWED_ORIGINS,
        rate_limit: process.env.ENABLE_RATE_LIMIT !== 'false',
      };

      // Déterminer le statut global
      if (health.checks.openai?.status === 'unhealthy') {
        health.status = 'degraded';
      }

      if (!health.checks.config.openai_key) {
        health.status = 'unhealthy';
      }
    }

    // Ajouter la latence de réponse
    health.responseTime = Date.now() - startTime;

    // Code de statut selon l'état
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;

    // Pour HEAD requests, pas de body
    if (req.method === 'HEAD') {
      return res.status(statusCode).end();
    }

    // Retourner la réponse
    return res.status(statusCode).json(health);

  } catch (error) {
    console.error('[Health Check] Error:', error);
    
    return res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
}

// Export pour tests
export const _internal = {
  checkOpenAI,
  checkRedis,
  getMemoryUsage,
};
