// Package main provides a Fabric-compatible academic chaincode implementation.
// It is a template for a permissioned network; it contains no public-authority
// certificates or government registry integration.
package main

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type LandRecordContract struct{ contractapi.Contract }

type SourceEvidence struct {
	RecordKeySHA256       string `json:"recordKeySha256"`
	SourceDocumentSHA256  string `json:"sourceDocumentSha256"`
	SourceReferenceSHA256 string `json:"sourceReferenceSha256"`
	StateCode             string `json:"stateCode"`
	VerificationClass     string `json:"verificationClass"`
	VerificationMethod    string `json:"verificationMethod"`
	VerifiedAt            string `json:"verifiedAt"`
	VerifiedByMSPID       string `json:"verifiedByMspId"`
}

type Property struct {
	ID                         string  `json:"id"`
	ParcelReferenceHMAC        string  `json:"parcelReferenceHmac"`
	TitleReferenceHMAC         string  `json:"titleReferenceHmac,omitempty"`
	AddressReferenceHMAC       string  `json:"addressReferenceHmac,omitempty"`
	AreaSqm                    float64 `json:"areaSqm"`
	LandType                   string  `json:"landType"`
	ClaimantReferenceHMAC      string  `json:"claimantReferenceHmac"`
	StateCode                  string  `json:"stateCode"`
	StateName                  string  `json:"stateName"`
	DistrictName               string  `json:"districtName"`
	DistrictSourceLgdCode      string  `json:"districtSourceLgdCode,omitempty"`
	SubDistrictName            string  `json:"subDistrictName,omitempty"`
	SubDistrictSourceLgdCode   string  `json:"subDistrictSourceLgdCode,omitempty"`
	RecordOrigin               string  `json:"recordOrigin"`
	ClaimantVerificationStatus string  `json:"claimantVerificationStatus"`
	LegalTitleStatus           string  `json:"legalTitleStatus"`
	AdminBoundaryVerification  string  `json:"adminBoundaryVerification"`
	Status                     string  `json:"status"`
	RejectionReasonHMAC        string  `json:"rejectionReasonHmac,omitempty"`
	DocumentHash               string  `json:"documentHash,omitempty"`
	StorageReferenceHMAC       string  `json:"storageReferenceHmac,omitempty"`
	CreatedAt                  string  `json:"createdAt"`
	UpdatedAt                  string  `json:"updatedAt"`
}

type Transfer struct {
	ID                  string `json:"id"`
	PropertyID          string `json:"propertyId"`
	SellerReferenceHMAC string `json:"sellerReferenceHmac"`
	BuyerReferenceHMAC  string `json:"buyerReferenceHmac"`
	Status              string `json:"status"`
	CreatedAt           string `json:"createdAt"`
	UpdatedAt           string `json:"updatedAt"`
}

type HistoryEntry struct {
	TxID      string    `json:"txId"`
	Timestamp string    `json:"timestamp"`
	IsDelete  bool      `json:"isDelete"`
	Record    *Property `json:"record,omitempty"`
}

func now() string                        { return time.Now().UTC().Format(time.RFC3339) }
func propertyKey(id string) string       { return "property:" + id }
func transferKey(id string) string       { return "transfer:" + id }
func sourceEvidenceKey(id string) string { return "source-evidence:" + id }

func validSHA256(value string) bool {
	if len(value) != 64 {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

func validHMAC256(value string) bool { return validSHA256(value) }

func (c *LandRecordContract) requireAuthority(ctx contractapi.TransactionContextInterface) error {
	role, found, err := ctx.GetClientIdentity().GetAttributeValue("role")
	if err != nil {
		return fmt.Errorf("read caller role: %w", err)
	}
	if !found || role != "authority" {
		return fmt.Errorf("authority certificate attribute is required")
	}
	return nil
}

func (c *LandRecordContract) requireApplication(ctx contractapi.TransactionContextInterface) error {
	role, found, err := ctx.GetClientIdentity().GetAttributeValue("role")
	if err != nil {
		return fmt.Errorf("read caller role: %w", err)
	}
	if !found || role != "application-service" {
		return fmt.Errorf("application-service certificate attribute is required")
	}
	return nil
}

// RecordSourceEvidence writes only keyed references and non-personal verification metadata.
// It deliberately does not store a person's name, parcel number, address, or title text on-chain.
func (c *LandRecordContract) RecordSourceEvidence(
	ctx contractapi.TransactionContextInterface,
	recordKeySHA256, sourceDocumentSHA256, sourceReferenceSHA256, stateCode, verificationClass, verificationMethod string,
) (*SourceEvidence, error) {
	if err := c.requireAuthority(ctx); err != nil {
		return nil, err
	}
	if !validSHA256(recordKeySHA256) || !validSHA256(sourceDocumentSHA256) || !validSHA256(sourceReferenceSHA256) {
		return nil, fmt.Errorf("record key, source document and source reference must be SHA-256 hex digests")
	}
	stateCode = regexp.MustCompile(`^[A-Z]{2,3}$`).FindString(stateCode)
	if stateCode == "" {
		return nil, fmt.Errorf("a valid State/UT code is required")
	}
	classes := map[string]bool{
		"MACHINE_TEXT_MATCHED_AND_AUTHORITY_CONFIRMED": true,
		"AUTHORITY_ATTESTED_VISUAL_REVIEW":             true,
	}
	methods := map[string]bool{
		"OFFICIAL_SOURCE_RECORD_REVIEW":     true,
		"DIGITALLY_SIGNED_ROR_REVIEW":       true,
		"AUTHORISED_API_RESPONSE_REVIEW":    true,
		"ISSUING_OFFICE_CERTIFICATE_REVIEW": true,
	}
	if !classes[verificationClass] || !methods[verificationMethod] {
		return nil, fmt.Errorf("unsupported source verification class or method")
	}
	key := sourceEvidenceKey(recordKeySHA256)
	existingBytes, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, fmt.Errorf("read existing source evidence: %w", err)
	}
	if existingBytes != nil {
		var existing SourceEvidence
		if err := json.Unmarshal(existingBytes, &existing); err != nil {
			return nil, err
		}
		if existing.SourceDocumentSHA256 == sourceDocumentSHA256 && existing.SourceReferenceSHA256 == sourceReferenceSHA256 && existing.VerificationClass == verificationClass {
			return &existing, nil
		}
		return nil, fmt.Errorf("source evidence already exists for this record key; use a new evidence reference for a new review")
	}
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("read authority MSP identity: %w", err)
	}
	evidence := SourceEvidence{
		RecordKeySHA256: recordKeySHA256, SourceDocumentSHA256: sourceDocumentSHA256,
		SourceReferenceSHA256: sourceReferenceSHA256, StateCode: stateCode,
		VerificationClass: verificationClass, VerificationMethod: verificationMethod,
		VerifiedAt: now(), VerifiedByMSPID: mspID,
	}
	encoded, err := json.Marshal(evidence)
	if err != nil {
		return nil, err
	}
	if err := ctx.GetStub().PutState(key, encoded); err != nil {
		return nil, err
	}
	if err := ctx.GetStub().SetEvent("SourceEvidenceRecorded", encoded); err != nil {
		return nil, err
	}
	return &evidence, nil
}

// ReadSourceEvidence is authority-restricted because the record key links to a personal record off-chain.
func (c *LandRecordContract) ReadSourceEvidence(ctx contractapi.TransactionContextInterface, recordKeySHA256 string) (*SourceEvidence, error) {
	if err := c.requireAuthority(ctx); err != nil {
		return nil, err
	}
	if !validSHA256(recordKeySHA256) {
		return nil, fmt.Errorf("record key must be a SHA-256 hex digest")
	}
	encoded, err := ctx.GetStub().GetState(sourceEvidenceKey(recordKeySHA256))
	if err != nil {
		return nil, err
	}
	if encoded == nil {
		return nil, fmt.Errorf("source evidence not found")
	}
	var evidence SourceEvidence
	if err := json.Unmarshal(encoded, &evidence); err != nil {
		return nil, err
	}
	return &evidence, nil
}

func (c *LandRecordContract) ReadProperty(ctx contractapi.TransactionContextInterface, id string) (*Property, error) {
	bytes, err := ctx.GetStub().GetState(propertyKey(id))
	if err != nil {
		return nil, fmt.Errorf("read property: %w", err)
	}
	if bytes == nil {
		return nil, fmt.Errorf("property %s does not exist", id)
	}
	var property Property
	if err := json.Unmarshal(bytes, &property); err != nil {
		return nil, err
	}
	return &property, nil
}

func (c *LandRecordContract) CreateProperty(
	ctx contractapi.TransactionContextInterface,
	id, parcelReferenceHMAC, titleReferenceHMAC, addressReferenceHMAC, claimantReferenceHMAC, landType, documentHash, storageReferenceHMAC string,
	areaSqm float64,
	stateCode, stateName, districtName, districtSourceLgdCode, subDistrictName, subDistrictSourceLgdCode,
	recordOrigin, claimantVerificationStatus, legalTitleStatus, adminBoundaryVerification string,
) (*Property, error) {
	if err := c.requireApplication(ctx); err != nil {
		return nil, err
	}
	exists, err := ctx.GetStub().GetState(propertyKey(id))
	if err != nil {
		return nil, err
	}
	if exists != nil {
		return nil, fmt.Errorf("property %s already exists", id)
	}
	if id == "" || !validHMAC256(parcelReferenceHMAC) || !validHMAC256(claimantReferenceHMAC) || areaSqm <= 0 || stateCode == "" || districtName == "" {
		return nil, fmt.Errorf("id, parcel reference digest, claimant HMAC, positive area, State/UT and District are required")
	}
	if titleReferenceHMAC != "" && !validHMAC256(titleReferenceHMAC) || addressReferenceHMAC != "" && !validHMAC256(addressReferenceHMAC) || storageReferenceHMAC != "" && !validHMAC256(storageReferenceHMAC) {
		return nil, fmt.Errorf("optional title, address and storage references must be HMAC-SHA-256 digests")
	}
	property := Property{
		ID: id, ParcelReferenceHMAC: parcelReferenceHMAC, TitleReferenceHMAC: titleReferenceHMAC,
		AddressReferenceHMAC: addressReferenceHMAC, AreaSqm: areaSqm,
		LandType: landType, ClaimantReferenceHMAC: claimantReferenceHMAC,
		StateCode: stateCode, StateName: stateName, DistrictName: districtName,
		DistrictSourceLgdCode: districtSourceLgdCode, SubDistrictName: subDistrictName,
		SubDistrictSourceLgdCode:   subDistrictSourceLgdCode,
		RecordOrigin:               "USER_SUBMITTED_UNVERIFIED",
		ClaimantVerificationStatus: "NOT_VERIFIED",
		LegalTitleStatus:           "NOT_VERIFIED_BY_STATUTORY_REGISTRY",
		AdminBoundaryVerification:  adminBoundaryVerification,
		Status:                     "PENDING", DocumentHash: documentHash, StorageReferenceHMAC: storageReferenceHMAC,
		CreatedAt: now(), UpdatedAt: now(),
	}
	// Never accept a client-supplied status that could imply statutory verification.
	if recordOrigin != "" && recordOrigin != "USER_SUBMITTED_UNVERIFIED" {
		return nil, fmt.Errorf("unsupported record origin")
	}
	if claimantVerificationStatus != "" && claimantVerificationStatus != "NOT_VERIFIED" {
		return nil, fmt.Errorf("claimant identity must start unverified")
	}
	if legalTitleStatus != "" && legalTitleStatus != "NOT_VERIFIED_BY_STATUTORY_REGISTRY" {
		return nil, fmt.Errorf("legal title must start unverified")
	}
	bytes, _ := json.Marshal(property)
	if err := ctx.GetStub().PutState(propertyKey(id), bytes); err != nil {
		return nil, err
	}
	_ = ctx.GetStub().SetEvent("PropertyClaimSubmitted", bytes)
	return &property, nil
}

func (c *LandRecordContract) ApproveProperty(ctx contractapi.TransactionContextInterface, id string) (*Property, error) {
	if err := c.requireAuthority(ctx); err != nil {
		return nil, err
	}
	property, err := c.ReadProperty(ctx, id)
	if err != nil {
		return nil, err
	}
	if property.Status != "PENDING" {
		return nil, fmt.Errorf("only pending properties can be approved")
	}
	property.Status, property.UpdatedAt = "APPROVED", now()
	bytes, _ := json.Marshal(property)
	if err := ctx.GetStub().PutState(propertyKey(id), bytes); err != nil {
		return nil, err
	}
	_ = ctx.GetStub().SetEvent("PropertyApproved", bytes)
	return property, nil
}

func (c *LandRecordContract) RejectProperty(ctx contractapi.TransactionContextInterface, id, reasonHMAC string) (*Property, error) {
	if err := c.requireAuthority(ctx); err != nil {
		return nil, err
	}
	property, err := c.ReadProperty(ctx, id)
	if err != nil {
		return nil, err
	}
	if property.Status != "PENDING" {
		return nil, fmt.Errorf("only pending claims can be rejected")
	}
	if !validHMAC256(reasonHMAC) {
		return nil, fmt.Errorf("rejection reason must be represented by an HMAC-SHA-256 reference")
	}
	property.Status, property.RejectionReasonHMAC, property.UpdatedAt = "REJECTED", reasonHMAC, now()
	bytes, _ := json.Marshal(property)
	if err := ctx.GetStub().PutState(propertyKey(id), bytes); err != nil {
		return nil, err
	}
	_ = ctx.GetStub().SetEvent("PropertyClaimRejected", bytes)
	return property, nil
}

func (c *LandRecordContract) ProposeTransfer(ctx contractapi.TransactionContextInterface, id, propertyID, sellerReferenceHMAC, buyerReferenceHMAC string) (*Transfer, error) {
	property, err := c.ReadProperty(ctx, propertyID)
	if err != nil {
		return nil, err
	}
	if err := c.requireApplication(ctx); err != nil {
		return nil, err
	}
	if property.Status != "APPROVED" || property.ClaimantReferenceHMAC != sellerReferenceHMAC {
		return nil, fmt.Errorf("workflow claimant validation failed")
	}
	if id == "" || !validHMAC256(sellerReferenceHMAC) || !validHMAC256(buyerReferenceHMAC) || buyerReferenceHMAC == sellerReferenceHMAC {
		return nil, fmt.Errorf("valid transfer and distinct buyer are required")
	}
	if bytes, err := ctx.GetStub().GetState(transferKey(id)); err != nil || bytes != nil {
		return nil, fmt.Errorf("transfer already exists or cannot be read")
	}
	transfer := Transfer{ID: id, PropertyID: propertyID, SellerReferenceHMAC: sellerReferenceHMAC, BuyerReferenceHMAC: buyerReferenceHMAC, Status: "PROPOSED", CreatedAt: now(), UpdatedAt: now()}
	bytes, _ := json.Marshal(transfer)
	if err := ctx.GetStub().PutState(transferKey(id), bytes); err != nil {
		return nil, err
	}
	_ = ctx.GetStub().SetEvent("TransferProposed", bytes)
	return &transfer, nil
}

func (c *LandRecordContract) AcceptTransfer(ctx contractapi.TransactionContextInterface, id, buyerID string) (*Transfer, error) {
	bytes, err := ctx.GetStub().GetState(transferKey(id))
	if err != nil || bytes == nil {
		return nil, fmt.Errorf("transfer %s does not exist", id)
	}
	var transfer Transfer
	if err := json.Unmarshal(bytes, &transfer); err != nil {
		return nil, err
	}
	if err := c.requireApplication(ctx); err != nil {
		return nil, err
	}
	if transfer.Status != "PROPOSED" || transfer.BuyerReferenceHMAC != buyerID || !validHMAC256(buyerID) {
		return nil, fmt.Errorf("buyer cannot accept this transfer")
	}
	transfer.Status, transfer.UpdatedAt = "ACCEPTED", now()
	bytes, _ = json.Marshal(transfer)
	if err := ctx.GetStub().PutState(transferKey(id), bytes); err != nil {
		return nil, err
	}
	_ = ctx.GetStub().SetEvent("TransferAccepted", bytes)
	return &transfer, nil
}

func (c *LandRecordContract) RejectTransfer(ctx contractapi.TransactionContextInterface, id, reasonHMAC string) (*Transfer, error) {
	if err := c.requireApplication(ctx); err != nil {
		return nil, err
	}
	bytes, err := ctx.GetStub().GetState(transferKey(id))
	if err != nil || bytes == nil {
		return nil, fmt.Errorf("transfer %s does not exist", id)
	}
	var transfer Transfer
	if err := json.Unmarshal(bytes, &transfer); err != nil {
		return nil, err
	}
	if transfer.Status != "PROPOSED" && transfer.Status != "ACCEPTED" {
		return nil, fmt.Errorf("transfer is already resolved")
	}
	if !validHMAC256(reasonHMAC) {
		return nil, fmt.Errorf("rejection reason must be represented by an HMAC-SHA-256 reference")
	}
	transfer.Status, transfer.UpdatedAt = "REJECTED", now()
	bytes, _ = json.Marshal(transfer)
	if err := ctx.GetStub().PutState(transferKey(id), bytes); err != nil {
		return nil, err
	}
	_ = ctx.GetStub().SetEvent("TransferRejected", []byte(reasonHMAC))
	return &transfer, nil
}

func (c *LandRecordContract) FinalizeTransfer(ctx contractapi.TransactionContextInterface, id string) (*Property, error) {
	if err := c.requireAuthority(ctx); err != nil {
		return nil, err
	}
	bytes, err := ctx.GetStub().GetState(transferKey(id))
	if err != nil || bytes == nil {
		return nil, fmt.Errorf("transfer %s does not exist", id)
	}
	var transfer Transfer
	if err := json.Unmarshal(bytes, &transfer); err != nil {
		return nil, err
	}
	if transfer.Status != "ACCEPTED" {
		return nil, fmt.Errorf("only accepted transfers can be finalized")
	}
	property, err := c.ReadProperty(ctx, transfer.PropertyID)
	if err != nil {
		return nil, err
	}
	if property.ClaimantReferenceHMAC != transfer.SellerReferenceHMAC || property.Status != "APPROVED" {
		return nil, fmt.Errorf("seller is not the current application claimant")
	}
	property.ClaimantReferenceHMAC = transfer.BuyerReferenceHMAC
	property.ClaimantVerificationStatus = "NOT_VERIFIED"
	property.LegalTitleStatus = "NOT_VERIFIED_BY_STATUTORY_REGISTRY"
	property.RecordOrigin = "USER_SUBMITTED_UNVERIFIED"
	property.UpdatedAt = now()
	transfer.Status, transfer.UpdatedAt = "FINALIZED", now()
	propertyBytes, _ := json.Marshal(property)
	transferBytes, _ := json.Marshal(transfer)
	if err := ctx.GetStub().PutState(propertyKey(property.ID), propertyBytes); err != nil {
		return nil, err
	}
	if err := ctx.GetStub().PutState(transferKey(id), transferBytes); err != nil {
		return nil, err
	}
	_ = ctx.GetStub().SetEvent("ClaimantReferenceUpdated", propertyBytes)
	return property, nil
}

func (c *LandRecordContract) MarkClaimantReferenceUpdate(ctx contractapi.TransactionContextInterface, transferID string) (*Property, error) {
	if err := c.requireAuthority(ctx); err != nil {
		return nil, err
	}
	bytes, err := ctx.GetStub().GetState(transferKey(transferID))
	if err != nil || bytes == nil {
		return nil, fmt.Errorf("transfer %s does not exist", transferID)
	}
	var transfer Transfer
	if err := json.Unmarshal(bytes, &transfer); err != nil {
		return nil, err
	}
	if transfer.Status != "FINALIZED" {
		return nil, fmt.Errorf("transfer is not workflow-finalized")
	}
	property, err := c.ReadProperty(ctx, transfer.PropertyID)
	if err != nil {
		return nil, err
	}
	_ = ctx.GetStub().SetEvent("ClaimantReferenceUpdateAudited", []byte(transferID))
	return property, nil
}

func (c *LandRecordContract) GetPropertyHistory(ctx contractapi.TransactionContextInterface, id string) ([]*HistoryEntry, error) {
	iterator, err := ctx.GetStub().GetHistoryForKey(propertyKey(id))
	if err != nil {
		return nil, err
	}
	defer iterator.Close()
	entries := []*HistoryEntry{}
	for iterator.HasNext() {
		record, err := iterator.Next()
		if err != nil {
			return nil, err
		}
		entry := &HistoryEntry{TxID: record.TxId, Timestamp: time.Unix(record.Timestamp.Seconds, int64(record.Timestamp.Nanos)).UTC().Format(time.RFC3339), IsDelete: record.IsDelete}
		if !record.IsDelete {
			var property Property
			if err := json.Unmarshal(record.Value, &property); err != nil {
				return nil, err
			}
			entry.Record = &property
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&LandRecordContract{})
	if err != nil {
		panic(fmt.Sprintf("create landrecords chaincode: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("start landrecords chaincode: %v", err))
	}
}
