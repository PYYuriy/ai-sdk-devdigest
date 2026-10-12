# Tools and Testing Conventions

## Tool error handling

Every tool that performs a side effect or an external call is wrapped with a
shared error handler. The wrapper catches any thrown exception and converts it
into a structured error result instead of letting the error crash the streamed
response. This means that if the weather API is unreachable, the model receives
a readable error object and can explain the failure to the user, rather than
the chat stream dying.

## Testing

The project uses Vitest for unit tests. Tool logic is separated from the AI SDK
tool wrappers so it can be tested directly: each function accepts its database
handle (and, where relevant, its fetch function) as an injected dependency.
Tests build an in-memory SQLite database with the same schema the application
uses, so they never touch the real database file or the network.

The embedding dimension used throughout the project is 768, matching the
`nomic-embed-text` model. Cosine similarity returns 1 for identical direction,
0 for orthogonal vectors, and -1 for opposite vectors.
