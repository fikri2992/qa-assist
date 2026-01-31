defmodule QaAssist.Analysis.Runner do
  import Ecto.Query, only: [from: 2]

  alias QaAssist.Analysis
  alias QaAssist.Recording.Chunk
  alias QaAssist.Recording.Event
  alias QaAssist.Recording.Session
  alias QaAssist.Repo

  def run_chunk(%Chunk{} = chunk) do
    Analysis.record_chunk_running(chunk)

    session = Repo.get(Session, chunk.session_id)
    events = load_events(chunk)

    payload = %{
      session: serialize_session(session),
      chunk: serialize_chunk(chunk),
      events: Enum.map(events, &serialize_event/1)
    }

    case call_ai(payload) do
      {:ok, report} ->
        Analysis.record_chunk_report(chunk, report)

      {:error, reason} ->
        Analysis.record_chunk_failure(chunk, reason)
    end
  end

  defp load_events(%Chunk{} = chunk) do
    query =
      if chunk.start_ts && chunk.end_ts do
        from(e in Event,
          where:
            e.session_id == ^chunk.session_id and e.ts >= ^chunk.start_ts and
              e.ts <= ^chunk.end_ts,
          order_by: [asc: e.ts]
        )
      else
        from(e in Event, where: e.session_id == ^chunk.session_id, order_by: [asc: e.ts])
      end

    Repo.all(query)
  end

  defp call_ai(payload) do
    url = analysis_url()

    case Req.post(url, json: payload) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status}} -> {:error, "analysis failed with status #{status}"}
      {:error, reason} -> {:error, Exception.message(reason)}
    end
  end

  defp analysis_url do
    config = Application.get_env(:qa_assist, :analysis_service, [])
    base = Keyword.get(config, :url, "http://localhost:8000")
    String.trim_trailing(base, "/") <> "/analyze"
  end

  defp serialize_session(nil), do: %{}

  defp serialize_session(session) do
    %{
      id: session.id,
      device_id: session.device_id,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      metadata: session.metadata || %{}
    }
  end

  defp serialize_chunk(chunk) do
    %{
      id: chunk.id,
      session_id: chunk.session_id,
      idx: chunk.idx,
      start_ts: chunk.start_ts,
      end_ts: chunk.end_ts,
      gcs_uri: chunk.gcs_uri,
      status: chunk.status,
      analysis_status: chunk.analysis_status
    }
  end

  defp serialize_event(event) do
    %{
      id: event.id,
      session_id: event.session_id,
      ts: event.ts,
      type: event.type,
      payload: event.payload
    }
  end
end
