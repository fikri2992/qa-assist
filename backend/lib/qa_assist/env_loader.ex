defmodule QaAssist.EnvLoader do
  @moduledoc false

  @dev_envs [:dev, :test]

  def load! do
    if dev_or_test?() do
      load_dotenv()
      apply_runtime_env()
    end

    :ok
  end

  defp dev_or_test? do
    Code.ensure_loaded?(Mix) and Mix.env() in @dev_envs
  end

  defp load_dotenv do
    env_path = Path.expand("../../.env", __DIR__)

    if File.exists?(env_path) do
      if Code.ensure_loaded?(Dotenvy) do
        apply(Dotenvy, :source!, [[system_env(), env_path], [side_effect: &put_missing_env/1]])
      end
    end
  end

  defp system_env do
    System.get_env()
    |> Enum.reject(fn {key, _} -> key == "" or String.contains?(key, "=") end)
    |> Map.new()
  end

  defp put_missing_env(vars) do
    Enum.each(vars, fn {key, value} ->
      if System.get_env(key) == nil do
        System.put_env(key, value)
      end
    end)
  end

  defp apply_runtime_env do
    Application.put_env(:qa_assist, :analysis_service,
      url: System.get_env("AI_SERVICE_URL", "http://localhost:8000")
    )

    redis_enabled =
      System.get_env("REDIS_ENABLED", "false")
      |> String.downcase()
      |> (&(&1 in ["1", "true", "yes"])).()

    redis_url = System.get_env("REDIS_URL", "redis://localhost:6379")
    redis_queue = System.get_env("REDIS_QUEUE", "qa_assist:analysis")

    Application.put_env(:qa_assist, :redis,
      enabled: redis_enabled,
      url: redis_url,
      queue: redis_queue
    )

    storage_backend = System.get_env("STORAGE_BACKEND", "local")

    if storage_backend == "gcs" do
      Application.put_env(:qa_assist, :storage,
        backend: QaAssist.Storage.Gcs,
        gcs: [
          bucket: System.get_env("GCS_BUCKET"),
          client_email: System.get_env("GCS_SIGNING_EMAIL"),
          private_key: System.get_env("GCS_SIGNING_PRIVATE_KEY"),
          expires: String.to_integer(System.get_env("GCS_UPLOAD_EXPIRES", "900")),
          region: System.get_env("GCS_SIGNING_REGION", "auto")
        ]
      )
    else
      current = Application.get_env(:qa_assist, :storage, [])
      local_path = Keyword.get(current, :local_path, "priv/static/storage")

      Application.put_env(:qa_assist, :storage,
        backend: QaAssist.Storage.Local,
        local_path: local_path
      )
    end
  end
end
