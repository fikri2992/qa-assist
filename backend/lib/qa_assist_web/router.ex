defmodule QaAssistWeb.Router do
  use QaAssistWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", QaAssistWeb do
    pipe_through :api

    get "/", RootController, :index
  end

  scope "/api", QaAssistWeb do
    pipe_through :api

    post "/auth/login", AuthController, :login
    get "/ai/health", AiHealthController, :show

    post "/devices", DeviceController, :create

    get "/sessions", SessionController, :index
    post "/sessions", SessionController, :create
    post "/sessions/:id/start", SessionController, :start
    post "/sessions/:id/stop", SessionController, :stop
    post "/sessions/:id/pause", SessionController, :pause
    post "/sessions/:id/resume", SessionController, :resume
    get "/sessions/:id", SessionController, :show

    post "/sessions/:id/chunks", ChunkController, :create
    patch "/chunks/:id", ChunkController, :update
    post "/chunks/:id/upload", ChunkController, :upload

    post "/sessions/:id/events", EventController, :create
    get "/sessions/:id/events", EventController, :index

    get "/sessions/:id/analysis", AnalysisController, :show
    post "/sessions/:id/chat", ChatController, :create

    get "/sessions/:id/artifacts", ArtifactController, :index
    get "/artifacts/:id", ArtifactController, :show
  end
end
