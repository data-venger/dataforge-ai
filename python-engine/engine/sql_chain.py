import re
from typing import List
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from engine.ollama_client import OllamaClient
from engine.vector_store import VectorStore

class SqlChain:
    def __init__(self, ollama: OllamaClient, vector_store: VectorStore):
        self.ollama = ollama
        self.vector_store = vector_store
        
        # DuckDB-specific SQL prompt
        self.template = """You are a DuckDB SQL expert. Your job is to convert the user's natural language request into a valid DuckDB SQL query.

Below are the schemas of the available tables in the user's database:
{schemas}

## Critical Rules to Prevent Errors:
1. ONLY return the final SQL query in your response. No markdown formatting, no explanation, no conversational text.
2. Ensure the query is valid DuckDB syntax.
3. If table names or column names contain special characters, spaces, slashes (/), or start with a number, YOU MUST wrap them in double quotes ("). 
   Example: SELECT "hours/shift", "salary_range_from" FROM "part_00000_table"
4. If the user asks for "average", use AVG().
5. If the user asks for "highest", use ORDER BY __ DESC LIMIT 1.
6. If the user asks to see the columns, schema, or descriptions of a table, use the DESCRIBE command.
   Example: DESCRIBE "part_00000_table";
7. Do NOT wrap the final output in ```sql ``` codeblocks. Just the raw SQL string.

User Question: {question}

SQL Query:"""
        
        self.prompt = ChatPromptTemplate.from_template(self.template)

    async def generate_sql(self, question: str) -> str:
        # 1. Retrieve relevant schemas
        query_embedding = await self.ollama.get_embedding(question)
        results = self.vector_store.search_sql_schemas(query_embedding, n_results=5)
        
        schemas = []
        if results and results.get("documents") and results["documents"][0]:
            schemas = results["documents"][0]
            
        if not schemas:
            return "-- No relevant tables found in the workspace."

        schemas_text = "\n\n".join(schemas)
        
        # 2. Construct the prompt
        prompt_val = self.prompt.format(schemas=schemas_text, question=question)

        # 3. Generate using Ollama (Manual LCEL style for now since OllamaClient is custom)
        response = await self.ollama.generate(prompt=prompt_val)
        
        return self._clean_sql(response)

    def _clean_sql(self, sql: str) -> str:
        sql = sql.strip()
        # Remove markdown code blocks if present
        sql = re.sub(r"^```(?:sql)?\n", "", sql, flags=re.IGNORECASE)
        sql = re.sub(r"\n```$", "", sql, flags=re.IGNORECASE)
        # Sometimes models add a trailing semicolon if they're too helpful, but DuckDB is fine with it
        return sql.strip()
