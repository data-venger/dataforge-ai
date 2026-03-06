import os
import chromadb
client = chromadb.PersistentClient(path=os.path.expanduser("~/.dataforge/chroma"))
collection = client.get_or_create_collection("sql_schemas")
results = collection.get()
print(f"Total SQL Schemas in ChromaDB: {len(results['ids'])}")
for i, id in enumerate(results['ids']):
    print(f"\n--- Table: {id} ---")
    print(results['documents'][i])
