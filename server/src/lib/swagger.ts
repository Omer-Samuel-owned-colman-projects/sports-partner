import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Sports Partner API',
      version: '1.0.0',
      description: 'API for finding and managing sports games with partners',
    },
    servers: [
      { url: '/api', description: 'API base path' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        Sport: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
        Venue: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            city: { type: 'string' },
          },
        },
        Weather: {
          type: 'object',
          nullable: true,
          properties: {
            tempC: { type: 'number' },
            rainMm: { type: 'number' },
          },
        },
        Game: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            scheduledAt: { type: 'string', format: 'date-time' },
            maxPlayers: { type: 'integer' },
            description: { type: 'string', nullable: true },
            isOpen: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            sport: { $ref: '#/components/schemas/Sport' },
            venue: { $ref: '#/components/schemas/Venue' },
            creator: {
              type: 'object',
              properties: { id: { type: 'string' } },
            },
            participantCount: { type: 'integer' },
            likeCount: { type: 'integer' },
            commentCount: { type: 'integer' },
            currentUserLiked: { type: 'boolean' },
            currentUserJoined: { type: 'boolean' },
            weather: { $ref: '#/components/schemas/Weather' },
          },
        },
        GameDetail: {
          allOf: [
            { $ref: '#/components/schemas/Game' },
            {
              type: 'object',
              properties: {
                participants: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      userId: { type: 'string' },
                      joinedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          ],
        },
        GameComment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            content: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        GameMutationBody: {
          type: 'object',
          required: ['sport_id', 'venue_id', 'date_time', 'max_players'],
          properties: {
            sport_id: { type: 'string' },
            venue_id: { type: 'string' },
            date_time: { type: 'string', format: 'date-time', description: 'Must be in the future' },
            max_players: { type: 'integer', minimum: 1, maximum: 500 },
            description: { type: 'string', nullable: true },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            profileImageUrl: { type: 'string', nullable: true },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: {
            200: {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ── Sports ──────────────────────────────────────────
      '/sports': {
        get: {
          tags: ['Sports'],
          summary: 'List all sports',
          responses: {
            200: {
              description: 'Array of sports',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      sports: { type: 'array', items: { $ref: '#/components/schemas/Sport' } },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ── Venues ──────────────────────────────────────────
      '/venues': {
        get: {
          tags: ['Venues'],
          summary: 'List all venues',
          responses: {
            200: {
              description: 'Array of venues',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      venues: { type: 'array', items: { $ref: '#/components/schemas/Venue' } },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ── Games ───────────────────────────────────────────
      '/games': {
        get: {
          tags: ['Games'],
          summary: 'List games (with optional filters & pagination)',
          parameters: [
            { name: 'sport', in: 'query', schema: { type: 'string' }, description: 'Sport ObjectId or name' },
            { name: 'venue', in: 'query', schema: { type: 'string' }, description: 'Venue ObjectId or name' },
            { name: 'user', in: 'query', schema: { type: 'string' }, description: 'Creator user ID (shows all games including closed)' },
            { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50 } },
          ],
          responses: {
            200: {
              description: 'List of games with optional pagination',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      games: { type: 'array', items: { $ref: '#/components/schemas/Game' } },
                      pagination: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                          hasMore: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Games'],
          summary: 'Create a new game',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/GameMutationBody' } },
            },
          },
          responses: {
            201: {
              description: 'Game created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { game: { type: 'object', properties: { id: { type: 'string' } } } },
                  },
                },
              },
            },
            400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            401: { description: 'Not authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      '/games/{id}': {
        get: {
          tags: ['Games'],
          summary: 'Get game details by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'Game detail with participants',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { game: { $ref: '#/components/schemas/GameDetail' } },
                  },
                },
              },
            },
            400: { description: 'Invalid game ID', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            404: { description: 'Game not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        put: {
          tags: ['Games'],
          summary: 'Update a game (creator only)',
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/GameMutationBody' } },
            },
          },
          responses: {
            200: {
              description: 'Game updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { game: { type: 'object', properties: { id: { type: 'string' } } } },
                  },
                },
              },
            },
            400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            401: { description: 'Not authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            403: { description: 'Not the game creator', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            404: { description: 'Game not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      '/games/{id}/join': {
        post: {
          tags: ['Games'],
          summary: 'Join a game',
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'Joined; returns updated game detail',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { game: { $ref: '#/components/schemas/GameDetail' } },
                  },
                },
              },
            },
            401: { description: 'Not authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            404: { description: 'Game not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            409: { description: 'Already joined or game is full', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        delete: {
          tags: ['Games'],
          summary: 'Leave a game',
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'Left; returns updated game detail',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { game: { $ref: '#/components/schemas/GameDetail' } },
                  },
                },
              },
            },
            401: { description: 'Not authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            404: { description: 'Game not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            409: { description: 'Not joined', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      '/games/{id}/like': {
        post: {
          tags: ['Games'],
          summary: 'Like a game',
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            204: { description: 'Liked (idempotent)' },
            401: { description: 'Not authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            404: { description: 'Game not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        delete: {
          tags: ['Games'],
          summary: 'Unlike a game',
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            204: { description: 'Unliked' },
            401: { description: 'Not authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      '/games/{id}/comments': {
        get: {
          tags: ['Games'],
          summary: 'List comments for a game',
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'Array of comments',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      comments: { type: 'array', items: { $ref: '#/components/schemas/GameComment' } },
                    },
                  },
                },
              },
            },
            401: { description: 'Not authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            404: { description: 'Game not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        post: {
          tags: ['Games'],
          summary: 'Add a comment to a game',
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['content'],
                  properties: {
                    content: { type: 'string', maxLength: 500 },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Comment created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { comment: { $ref: '#/components/schemas/GameComment' } },
                  },
                },
              },
            },
            400: { description: 'Empty or too long content', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            401: { description: 'Not authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            404: { description: 'Game not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      // ── Auth ─────────────────────────────────────────────
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'email', 'password'],
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 6 },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'User registered; auth cookies set',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } },
                },
              },
            },
            400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            409: { description: 'Email already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Log in with email & password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Logged in; auth cookies set',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } },
                },
              },
            },
            401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Rotate refresh token and get new access token',
          responses: {
            200: {
              description: 'Tokens rotated; new cookies set',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } },
                },
              },
            },
            401: { description: 'Invalid or missing refresh token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Log out (clears cookies)',
          responses: {
            200: {
              description: 'Logged out',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { success: { type: 'boolean' } } },
                },
              },
            },
          },
        },
      },

      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current authenticated user',
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Current user',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } },
                },
              },
            },
            401: { description: 'Not authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      '/auth/profile': {
        put: {
          tags: ['Auth'],
          summary: 'Update profile (name and/or profile image)',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', maxLength: 100 },
                    profileImage: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Profile updated',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } },
                },
              },
            },
            400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            401: { description: 'Not authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      '/auth/google': {
        get: {
          tags: ['Auth'],
          summary: 'Initiate Google OAuth2 login',
          responses: {
            302: { description: 'Redirects to Google consent screen' },
          },
        },
      },

      // ── AI ──────────────────────────────────────────────
      '/ai/search': {
        post: {
          tags: ['AI'],
          summary: 'Natural-language game search powered by AI',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['query'],
                  properties: {
                    query: { type: 'string', description: 'Free-text search query (any language)' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Search results with AI-generated summary',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      detectedLanguage: { type: 'string' },
                      parsedSearch: {
                        type: 'object',
                        properties: {
                          sportType: { type: 'string', nullable: true },
                          city: { type: 'string', nullable: true },
                          dateFrom: { type: 'string', nullable: true },
                          dateTo: { type: 'string', nullable: true },
                          detectedLanguage: { type: 'string' },
                        },
                      },
                      games: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            sport: { type: 'string' },
                            venue: { type: 'string' },
                            city: { type: 'string' },
                            scheduledAt: { type: 'string', format: 'date-time' },
                            maxPlayers: { type: 'integer' },
                            isOpen: { type: 'boolean' },
                            description: { type: 'string', nullable: true },
                          },
                        },
                      },
                      answer: { type: 'string' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing query', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
