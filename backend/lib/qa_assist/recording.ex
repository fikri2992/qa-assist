defmodule QaAssist.Recording do
  import Ecto.Query, only: [from: 2]

  alias QaAssist.Analysis
  alias QaAssist.Devices
  alias QaAssist.Recording.Chunk
  alias QaAssist.Recording.Event
  alias QaAssist.Recording.Session
  alias QaAssist.Repo

  def create_session(device_id, metadata \\ %{}) when is_map(metadata) do
    case Devices.get_device(device_id) do
      nil ->
        {:error, :device_not_found}

      _device ->
        %Session{device_id: device_id}
        |> Session.changeset(%{status: "paused", metadata: metadata})
        |> Repo.insert()
    end
  end

  def start_session(%Session{} = session) do
    attrs =
      session
      |> Map.from_struct()
      |> Map.take([:started_at])

    started_at = session.started_at || DateTime.utc_now()

    session
    |> Session.changeset(Map.merge(attrs, %{status: "recording", started_at: started_at}))
    |> Repo.update()
  end

  def stop_session(%Session{} = session) do
    session
    |> Session.changeset(%{status: "ended", ended_at: DateTime.utc_now()})
    |> Repo.update()
    |> case do
      {:ok, updated} ->
        Analysis.enqueue_session(updated)
        {:ok, updated}

      error ->
        error
    end
  end

  def pause_session(%Session{} = session) do
    session
    |> Session.changeset(%{status: "paused", idle_paused_at: DateTime.utc_now()})
    |> Repo.update()
  end

  def resume_session(%Session{} = session) do
    session
    |> Session.changeset(%{status: "recording", idle_paused_at: nil})
    |> Repo.update()
  end

  def get_session(id) do
    Repo.get(Session, id)
  end

  def get_session_with_device(id) do
    Session
    |> Repo.get(id)
    |> Repo.preload([:device])
  end

  def get_session_with_children(id) do
    Session
    |> Repo.get(id)
    |> Repo.preload([:chunks])
  end

  def list_sessions(device_id) do
    from(s in Session,
      where: s.device_id == ^device_id,
      order_by: [desc: s.inserted_at]
    )
    |> Repo.all()
  end

  def list_sessions_by_user(user_id) do
    from(s in Session,
      join: d in assoc(s, :device),
      where: d.user_id == ^user_id,
      order_by: [desc: s.inserted_at]
    )
    |> Repo.all()
  end

  def create_chunk(session_id, attrs) do
    %Chunk{session_id: session_id}
    |> Chunk.changeset(%{
      idx: attrs["idx"],
      start_ts: parse_ts(attrs["start_ts"]),
      end_ts: parse_ts(attrs["end_ts"]),
      status: Map.get(attrs, "status", "uploading"),
      analysis_status: Map.get(attrs, "analysis_status", "pending"),
      content_type: attrs["content_type"],
      byte_size: attrs["byte_size"]
    })
    |> Repo.insert()
  end

  def update_chunk(%Chunk{} = chunk, attrs) do
    status = Map.get(attrs, "status", chunk.status)
    analysis_status = Map.get(attrs, "analysis_status", chunk.analysis_status)
    idx = Map.get(attrs, "idx", chunk.idx)
    gcs_uri = Map.get(attrs, "gcs_uri", chunk.gcs_uri)
    byte_size = Map.get(attrs, "byte_size", chunk.byte_size)
    content_type = Map.get(attrs, "content_type", chunk.content_type)

    chunk
    |> Chunk.changeset(%{
      idx: idx,
      status: status,
      analysis_status: analysis_status,
      gcs_uri: gcs_uri,
      byte_size: byte_size,
      content_type: content_type
    })
    |> Repo.update()
    |> case do
      {:ok, updated} ->
        if should_enqueue_analysis?(chunk, updated) do
          Analysis.enqueue_chunk(updated)
        end

        {:ok, updated}

      error ->
        error
    end
  end

  def mark_chunk_ready(%Chunk{} = chunk, gcs_uri, byte_size, content_type) do
    chunk
    |> Chunk.changeset(%{
      status: "ready",
      gcs_uri: gcs_uri,
      byte_size: byte_size,
      content_type: content_type,
      analysis_status: "pending"
    })
    |> Repo.update()
    |> case do
      {:ok, updated} ->
        Analysis.enqueue_chunk(updated)
        {:ok, updated}

      error ->
        error
    end
  end

  def list_chunks(session_id) do
    from(c in Chunk, where: c.session_id == ^session_id, order_by: [asc: c.idx])
    |> Repo.all()
  end

  def get_chunk(id), do: Repo.get(Chunk, id)

  def record_events(session_id, events) when is_list(events) do
    entries =
      Enum.reduce(events, [], fn event, acc ->
        case build_event(session_id, event) do
          {:ok, entry} -> [entry | acc]
          {:error, _reason} -> acc
        end
      end)

    case entries do
      [] ->
        {:error, :no_events}

      _ ->
        {count, _} = Repo.insert_all(Event, entries)
        {:ok, count}
    end
  end

  def list_events(session_id, limit \\ 200) do
    from(e in Event,
      where: e.session_id == ^session_id,
      order_by: [desc: e.ts],
      limit: ^limit
    )
    |> Repo.all()
  end

  def list_events_all(session_id) do
    from(e in Event,
      where: e.session_id == ^session_id,
      order_by: [asc: e.ts]
    )
    |> Repo.all()
  end

  defp build_event(session_id, %{"ts" => ts, "type" => type, "payload" => payload}) do
    case parse_ts(ts) do
      nil ->
        {:error, :invalid_ts}

      parsed ->
        {:ok,
         %{
           id: Ecto.UUID.generate(),
           session_id: session_id,
           ts: parsed,
           type: type,
           payload: payload
         }}
    end
  end

  defp build_event(session_id, %{"type" => _type} = event) do
    build_event(
      session_id,
      Map.put_new(event, "ts", DateTime.utc_now()) |> Map.put_new("payload", %{})
    )
  end

  defp build_event(_session_id, _event), do: {:error, :invalid_event}

  defp parse_ts(nil), do: nil

  defp parse_ts(%DateTime{} = dt), do: normalize_dt(dt)

  defp parse_ts(ts) when is_integer(ts) do
    ts
    |> DateTime.from_unix!(:millisecond)
    |> normalize_dt()
  end

  defp parse_ts(ts) when is_binary(ts) do
    case DateTime.from_iso8601(ts) do
      {:ok, dt, _offset} -> normalize_dt(dt)
      _ -> nil
    end
  end

  defp normalize_dt(%DateTime{} = dt) do
    dt
    |> DateTime.to_unix(:microsecond)
    |> DateTime.from_unix!(:microsecond)
  end

  defp should_enqueue_analysis?(%Chunk{} = before, %Chunk{} = updated) do
    updated.status == "ready" and updated.analysis_status == "pending" and
      (before.status != updated.status or before.analysis_status != updated.analysis_status)
  end
end
