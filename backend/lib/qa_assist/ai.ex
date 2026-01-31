defmodule QaAssist.AI do
  def chat(payload) when is_map(payload) do
    url = analysis_url("/chat")

    case Req.post(url, json: payload) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status}} -> {:error, "chat failed with status #{status}"}
      {:error, reason} -> {:error, Exception.message(reason)}
    end
  end

  defp analysis_url(path) do
    config = Application.get_env(:qa_assist, :analysis_service, [])
    base = Keyword.get(config, :url, "http://localhost:8000")
    String.trim_trailing(base, "/") <> path
  end
end
