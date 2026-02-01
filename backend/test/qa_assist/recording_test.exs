defmodule QaAssist.RecordingTest do
  use QaAssist.DataCase, async: true

  alias QaAssist.Accounts
  alias QaAssist.Devices
  alias QaAssist.Recording

  test "update_chunk accepts missing idx and preserves existing value" do
    {:ok, user} =
      Accounts.create_user("recording-test-#{System.unique_integer([:positive])}@qaassist.local", "secret123")

    {:ok, device} = Devices.create_device(user.id, %{})
    {:ok, session} = Recording.create_session(device.id, %{})

    now = DateTime.utc_now()

    {:ok, chunk} =
      Recording.create_chunk(session.id, %{
        "idx" => 0,
        "start_ts" => now,
        "end_ts" => now,
        "content_type" => "video/webm"
      })

    {:ok, updated} =
      Recording.update_chunk(chunk, %{
        "status" => "ready",
        "analysis_status" => "pending",
        "gcs_uri" => "gs://qa-assist-test/chunk-0.webm",
        "byte_size" => 123,
        "content_type" => "video/webm"
      })

    assert updated.idx == chunk.idx
    assert updated.status == "ready"
    assert updated.analysis_status == "pending"
    assert updated.gcs_uri == "gs://qa-assist-test/chunk-0.webm"
    assert updated.byte_size == 123
  end
end
