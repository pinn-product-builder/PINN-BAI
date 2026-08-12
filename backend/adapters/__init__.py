# Importar todos os adapters CRM — força registro via @register_adapter
from . import kommo  # noqa: F401

# Adapters de tráfego pago — força registro via @register_ad_adapter
from . import meta_ads, google_ads  # noqa: F401
