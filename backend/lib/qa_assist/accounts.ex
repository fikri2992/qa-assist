defmodule QaAssist.Accounts do
  import Ecto.Query, only: [from: 2]

  alias QaAssist.Accounts.AuthToken
  alias QaAssist.Accounts.User
  alias QaAssist.Repo

  def get_user_by_email(email) when is_binary(email) do
    Repo.get_by(User, email: String.downcase(email))
  end

  def create_user(email, password) when is_binary(email) and is_binary(password) do
    salt = generate_salt()
    password_hash = hash_password(password, salt)

    %User{}
    |> User.changeset(%{
      email: email,
      password_hash: password_hash,
      password_salt: salt
    })
    |> Repo.insert()
  end

  def authenticate(email, password) when is_binary(email) and is_binary(password) do
    case get_user_by_email(email) do
      nil ->
        {:error, :invalid_credentials}

      user ->
        if verify_password(password, user.password_salt, user.password_hash) do
          {:ok, user}
        else
          {:error, :invalid_credentials}
        end
    end
  end

  def issue_token(%User{} = user) do
    token = generate_token()

    %AuthToken{}
    |> AuthToken.changeset(%{token: token, user_id: user.id})
    |> Repo.insert()
    |> case do
      {:ok, auth_token} -> {:ok, auth_token}
      error -> error
    end
  end

  def get_user_by_token(token) when is_binary(token) do
    AuthToken
    |> from(where: [token: ^token], preload: [:user])
    |> Repo.one()
    |> case do
      %AuthToken{user: %User{} = user} -> user
      _ -> nil
    end
  end

  defp generate_salt do
    16
    |> :crypto.strong_rand_bytes()
    |> Base.url_encode64(padding: false)
  end

  defp generate_token do
    32
    |> :crypto.strong_rand_bytes()
    |> Base.url_encode64(padding: false)
  end

  defp hash_password(password, salt) do
    :crypto.hash(:sha256, salt <> password)
    |> Base.encode16(case: :lower)
  end

  defp verify_password(password, salt, hash) do
    computed = hash_password(password, salt)
    Plug.Crypto.secure_compare(computed, hash)
  end
end
