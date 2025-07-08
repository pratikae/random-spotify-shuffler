from sqlalchemy import create_engine, Column, String, Integer, ForeignKey, Table, Date, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

DATABASE_URL = "sqlite:///spotify_cache.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# join table
playlist_track_table = Table(
    "playlist_track", Base.metadata,
    Column("playlist_id", String, ForeignKey("playlists.id"), primary_key=True),
    Column("track_id", String, ForeignKey("tracks.id"), primary_key=True)
)

saved_track_table = Table(
    "saved_track", Base.metadata,
    Column("user_id", String, ForeignKey("users.id"), primary_key=True),
    Column("track_id", String, ForeignKey("tracks.id"), primary_key=True)
)

track_artist_table = Table(
    "track_artists", Base.metadata,
    Column("track_id", String, ForeignKey("tracks.id"), primary_key=True),
    Column("artist_id", String, ForeignKey("artists.id"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    curr_index = Column(Integer, default=0)

    playlists = relationship("Playlist", back_populates="user")
    saved_tracks = relationship("Track", secondary=saved_track_table, back_populates="saved_by_users")

class Playlist(Base):
    __tablename__ = "playlists"
    id = Column(String, primary_key=True)
    name = Column(String)
    user_id = Column(String, ForeignKey("users.id"))

    user = relationship("User", back_populates="playlists")
    tracks = relationship("Track", secondary=playlist_track_table, back_populates="playlists")

class Album(Base):
    __tablename__ = "albums"
    id = Column(String, primary_key=True)
    name = Column(String)
    release_date = Column(String)

    tracks = relationship("Track", back_populates="album")

class Artist(Base):
    __tablename__ = "artists"
    id = Column(String, primary_key=True)
    name = Column(String)

    tracks = relationship("Track", secondary=track_artist_table, back_populates="artists")

class Track(Base):
    __tablename__ = "tracks"
    id = Column(String, primary_key=True)
    name = Column(String)
    album_id = Column(String, ForeignKey("albums.id"), nullable=True)
    
    album = relationship("Album", back_populates="tracks")
    artists = relationship("Artist", secondary=track_artist_table, back_populates="tracks")
    playlists = relationship("Playlist", secondary=playlist_track_table, back_populates="tracks")
    saved_by_users = relationship("User", secondary=saved_track_table, back_populates="saved_tracks")
    
class Show(Base):
    __tablename__ = "shows"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    episodes = relationship("PodcastEpisode", back_populates="show")

class PodcastEpisode(Base):
    __tablename__ = "podcast_episodes"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    show_id = Column(String, ForeignKey("shows.id"))
    release_date = Column(Date, nullable=True)

    show = relationship("Show", back_populates="episodes")
    
# only a bundle of two for now
class Bundle(Base):
    __tablename__ = 'bundles'
    id = Column(Integer, primary_key=True)

    intro_song_id = Column(String, nullable=False)  # first song
    main_song_id = Column(String, nullable=False)   # second song
    strict = Column(Boolean, default=False) # plays bundle no matter if main or intro comes on shuffle

def init_db():
    Base.metadata.create_all(bind=engine)
