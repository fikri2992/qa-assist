defmodule QaAssist.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "users" do
    field :email, :string
    field :password_hash, :string
    field :password_salt, :string

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :password_hash, :password_salt])
    |> validate_required([:email, :password_hash, :password_salt])
    |> update_change(:email, &String.downcase/1)
    |> unique_constraint(:email)
  end
end
