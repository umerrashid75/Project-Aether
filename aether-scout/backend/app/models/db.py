"""
Motor client + collection helpers.
"""
from motor.motor_asyncio import AsyncIOMotorClient
import pymongo
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db = None

    @classmethod
    async def connect(cls):
        uri = os.getenv("MONGODB_URI")
        db_name = os.getenv("MONGODB_DB", "aether_db")
        
        if not uri:
            logger.warning("MONGODB_URI not found in env, skipping DB connection (check your .env)")
            return
            
        try:
            cls.client = AsyncIOMotorClient(
                uri, 
                serverSelectionTimeoutMS=5000,
                tlsAllowInvalidCertificates=True
            )
            cls.db = cls.client[db_name]
            
            # Test connection
            await cls.client.admin.command('ping')
            logger.info("Successfully connected to MongoDB.")
            
            # Create indexes
            await cls._init_indexes()
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    @classmethod
    async def _init_indexes(cls):
        if cls.db is None:
            return
            
        # aircraft_states
        # TTL index on timestamp (expire after 600s)
        await cls.db["aircraft_states"].create_index([("timestamp", pymongo.ASCENDING)], expireAfterSeconds=600)
        # geo index on position
        await cls.db["aircraft_states"].create_index([("position", pymongo.GEOSPHERE)])
        
        # vessel_states
        # TTL index on timestamp (expire after 600s)
        await cls.db["vessel_states"].create_index([("timestamp", pymongo.ASCENDING)], expireAfterSeconds=600)
        # geo index on position
        await cls.db["vessel_states"].create_index([("position", pymongo.GEOSPHERE)])
        
        # anomalies
        # standard index on detected_at descending
        await cls.db["anomalies"].create_index([("detected_at", pymongo.DESCENDING)])
        
        # sitreps
        # standard index on created_at descending
        await cls.db["sitreps"].create_index([("created_at", pymongo.DESCENDING)])
        
        logger.info("Database indexes initialized successfully.")

    @classmethod
    async def disconnect(cls):
        if cls.client:
            cls.client.close()
            logger.info("Disconnected from MongoDB.")
