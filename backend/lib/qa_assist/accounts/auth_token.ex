defmodule QaAssist.Accounts.AuthToken do
  use Ecto.Schema
  import Ecto.Changeset

  alias QaAssist.Accounts.User

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "auth_tokens" do
    field :token, :string
    belongs_to :user, User

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(token, attrs) do
    token
    |> cast(attrs, [:token, :user_id])
    |> validate_required([:token, :user_id])
    |> unique_constraint(:token)
  end
end
