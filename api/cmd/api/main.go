package main

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/golang-jwt/jwt/v5"
	echojwt "github.com/labstack/echo-jwt/v5"
	"github.com/labstack/echo/v5"

	migrationfs "github.com/hansenhalim/dgb/api/db"
	authcontroller "github.com/hansenhalim/dgb/api/internal/auth/controller"
	authrepository "github.com/hansenhalim/dgb/api/internal/auth/repository"
	authusecase "github.com/hansenhalim/dgb/api/internal/auth/usecase"
	destinationcontroller "github.com/hansenhalim/dgb/api/internal/destination/controller"
	destinationrepository "github.com/hansenhalim/dgb/api/internal/destination/repository"
	destinationusecase "github.com/hansenhalim/dgb/api/internal/destination/usecase"
	extractidcontroller "github.com/hansenhalim/dgb/api/internal/extractid/controller"
	gatecontroller "github.com/hansenhalim/dgb/api/internal/gate/controller"
	gaterepository "github.com/hansenhalim/dgb/api/internal/gate/repository"
	gateusecase "github.com/hansenhalim/dgb/api/internal/gate/usecase"
	homecontroller "github.com/hansenhalim/dgb/api/internal/home/controller"
	homerepository "github.com/hansenhalim/dgb/api/internal/home/repository"
	homeusecase "github.com/hansenhalim/dgb/api/internal/home/usecase"
	rfidcontroller "github.com/hansenhalim/dgb/api/internal/rfid/controller"
	rfidusecase "github.com/hansenhalim/dgb/api/internal/rfid/usecase"
	"github.com/hansenhalim/dgb/api/internal/shared/clock"
	"github.com/hansenhalim/dgb/api/internal/shared/config"
	"github.com/hansenhalim/dgb/api/internal/shared/database"
	"github.com/hansenhalim/dgb/api/internal/shared/digester"
	"github.com/hansenhalim/dgb/api/internal/shared/gateavailability"
	"github.com/hansenhalim/dgb/api/internal/shared/gatewebhook"
	"github.com/hansenhalim/dgb/api/internal/shared/hasher"
	"github.com/hansenhalim/dgb/api/internal/shared/httperror"
	jwtissuer "github.com/hansenhalim/dgb/api/internal/shared/jwt"
	"github.com/hansenhalim/dgb/api/internal/shared/laravelcrypt"
	"github.com/hansenhalim/dgb/api/internal/shared/server"
	"github.com/hansenhalim/dgb/api/internal/shared/tx"
	trcontroller "github.com/hansenhalim/dgb/api/internal/transferrequest/controller"
	trrepository "github.com/hansenhalim/dgb/api/internal/transferrequest/repository"
	trusecase "github.com/hansenhalim/dgb/api/internal/transferrequest/usecase"
	visitorcontroller "github.com/hansenhalim/dgb/api/internal/visitor/controller"
	visitorrepository "github.com/hansenhalim/dgb/api/internal/visitor/repository"
	visitorusecase "github.com/hansenhalim/dgb/api/internal/visitor/usecase"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("load config", "err", err)
		os.Exit(1)
	}

	db, err := database.NewPostgres(cfg.PostgresDSN(), cfg.AppEnv == "production")
	if err != nil {
		logger.Error("connect postgres", "err", err)
		os.Exit(1)
	}

	sqlDB, err := db.DB()
	if err != nil {
		logger.Error("get sql.DB", "err", err)
		os.Exit(1)
	}
	if err := database.Migrate(sqlDB, migrationfs.MigrationsFS); err != nil {
		logger.Error("run migrations", "err", err)
		os.Exit(1)
	}
	logger.Info("migrations applied")

	bcrypt := hasher.NewBcrypt()
	sha256 := digester.NewSHA256()
	systemClock := clock.NewSystem()
	issuer := jwtissuer.NewHS256([]byte(cfg.JWTSecret))
	availability := gateavailability.NewEnv()
	pulser := gatewebhook.NewPulser()
	encryptor, err := laravelcrypt.New(cfg.AppKey)
	if err != nil {
		logger.Error("init encryptor", "err", err)
		os.Exit(1)
	}
	txRunner := tx.NewGorm(db)

	rfidRepo := authrepository.NewRfidRepository(db)
	gateRepo := gaterepository.NewGateRepository(db)
	trRepo := trrepository.NewTransferRequestRepository(db)
	visitorRepo := visitorrepository.NewVisitorRepository(db)
	visitRepo := visitorrepository.NewVisitRepository(db)
	destinationRepo := destinationrepository.NewDestinationRepository(db)
	homeRepo := homerepository.NewHomeRepository(db)

	verifyPin := authusecase.NewVerifyPin(rfidRepo, bcrypt)
	verifySecret := authusecase.NewVerifySecret(rfidRepo, sha256, issuer, systemClock)
	listGates := gateusecase.NewListGates(gateRepo, availability)
	checkTR := trusecase.NewCheckTransferRequest(trRepo)
	createTR := trusecase.NewCreateTransferRequest(trRepo, gateRepo)
	respondTR := trusecase.NewRespondTransferRequest(trRepo, systemClock)
	getRfidKey := rfidusecase.NewGetRfidKey(rfidRepo)
	getVisitorStatus := visitorusecase.NewGetVisitorStatus(visitorRepo, visitRepo, sha256)
	createVisit := visitorusecase.NewCreateVisit(rfidRepo, visitorRepo, visitRepo, gateRepo, sha256, encryptor, systemClock, txRunner)
	checkoutVisit := visitorusecase.NewCheckoutVisit(visitRepo, visitorRepo, gateRepo, rfidRepo, systemClock, txRunner)
	transitVisit := visitorusecase.NewTransitVisit(visitRepo)
	transitEnterVisit := visitorusecase.NewTransitEnterVisit(visitRepo)
	getVisitHistory := visitorusecase.NewGetVisitHistory(visitRepo)
	listDestinations := destinationusecase.NewListDestinations(destinationRepo)
	getHome := homeusecase.NewGetHome(homeRepo, systemClock)

	jwtMW := echojwt.WithConfig(echojwt.Config{
		SigningKey:    []byte(cfg.JWTSecret),
		SigningMethod: "HS256",
		NewClaimsFunc: func(_ *echo.Context) jwt.Claims {
			return new(jwt.RegisteredClaims)
		},
		ErrorHandler: func(_ *echo.Context, _ error) error {
			return httperror.New(401, "Invalid token.")
		},
	})

	authCtrl := authcontroller.NewAuthController(verifyPin, verifySecret)
	gateCtrl := gatecontroller.NewGateController(listGates, pulser, jwtMW)
	trCtrl := trcontroller.NewTransferRequestController(checkTR, createTR, respondTR, jwtMW)
	rfidCtrl := rfidcontroller.NewRfidController(getRfidKey, jwtMW)
	visitorCtrl := visitorcontroller.NewVisitorController(getVisitorStatus, createVisit, checkoutVisit, transitVisit, transitEnterVisit, getVisitHistory, jwtMW)
	destinationCtrl := destinationcontroller.NewDestinationController(listDestinations, jwtMW)
	homeCtrl := homecontroller.NewHomeController(getHome, jwtMW)
	extractIDCtrl := extractidcontroller.NewExtractIDController(cfg.OCRURL, jwtMW)

	e := server.NewEcho(cfg.AppEnv == "production")

	v2 := e.Group("/v2")
	authCtrl.Register(v2.Group("/auth"))
	gateCtrl.Register(v2.Group("/gates"))
	trCtrl.Register(v2.Group("/transfer-requests"), v2.Group("/gates"))
	rfidCtrl.Register(v2.Group("/rfid-key"))
	visitorCtrl.RegisterVisitors(v2.Group("/visitors"))
	visitorCtrl.RegisterVisits(v2.Group("/visits"))
	destinationCtrl.Register(v2.Group("/destinations"))
	homeCtrl.Register(v2.Group("/home"))
	extractIDCtrl.Register(v2.Group("/extract-id"))

	addr := fmt.Sprintf(":%d", cfg.AppPort)
	logger.Info("server starting", "addr", addr, "env", cfg.AppEnv)
	if err := e.Start(addr); err != nil {
		logger.Error("server stopped", "err", err)
		os.Exit(1)
	}
}
