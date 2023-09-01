//SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

import {RemiliasRegistrar} from "./RemiliasRegistrar.sol";
import {StringUtils} from "./StringUtils.sol";
import {Resolver} from "../resolvers/Resolver.sol";
import {ENS} from "../registry/ENS.sol";
import {ReverseRegistrar} from "../reverseRegistrar/ReverseRegistrar.sol";
import {ReverseClaimer} from "../reverseRegistrar/ReverseClaimer.sol";
import {IRemiliasRegistrarController} from "./IRemiliasRegistrarController.sol";

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IRemiliasNameWrapper} from "../wrapper/IRemiliasNameWrapper.sol";
import {ERC20Recoverable} from "../utils/ERC20Recoverable.sol";

error CommitmentTooNew(bytes32 commitment);
error CommitmentTooOld(bytes32 commitment);
error NameNotAvailable(string name);
error DurationTooShort(uint256 duration);
error ResolverRequiredWhenDataSupplied();
error UnexpiredCommitmentExists(bytes32 commitment);
error InsufficientValue();
error UnauthorisedHolder();
error Unauthorised(bytes32 node);
error MaxCommitmentAgeTooLow();
error MaxCommitmentAgeTooHigh();
error InvalidCollection();
error RegisteredNFT();

/**
 * @dev A registrar controller for registering name for each Remilia NFT.
 */
contract RemiliasRegistrarController is
    Ownable,
    IRemiliasRegistrarController,
    IERC165,
    ReverseClaimer
{
    using StringUtils for *;
    using Address for address;

    bytes32 private constant REMILIAS_NODE =
        0xf029b4b627c4a2cd7f70eb6bb0281fec39238419d6d4df5a010dad7432a8d5c8;
    RemiliasRegistrar immutable base;
    ReverseRegistrar public immutable reverseRegistrar;
    IRemiliasNameWrapper public immutable nameWrapper;

    mapping(address => bool) public nftContracts;
    mapping(address => mapping(uint256 => string)) public nftIds;

    event NameRegistered(
        string name,
        bytes32 indexed label,
        address indexed owner,
        address indexed collection,
        uint256 nft
    );

    event CollectionAdded(address collection);
    event CollectionRemoved(address collection);

    constructor(
        RemiliasRegistrar _base,
        ReverseRegistrar _reverseRegistrar,
        IRemiliasNameWrapper _nameWrapper,
        ENS _ens
    ) ReverseClaimer(_ens, msg.sender) {
        base = _base;
        reverseRegistrar = _reverseRegistrar;
        nameWrapper = _nameWrapper;
    }

    // Authorises a nft contract, nft holders can set name and rename their nfts.
    function addCollection(address collection) external onlyOwner {
        nftContracts[collection] = true;
        emit CollectionAdded(collection);
    }

    // Revoke milady permission for an nft contract.
    function removeCollection(address collection) external onlyOwner {
        nftContracts[collection] = false;
        emit CollectionRemoved(collection);
    }

    function valid(string memory name) public pure returns (bool) {
        return name.strlen() >= 1;
    }

    function available(string memory name) public view override returns (bool) {
        bytes32 label = keccak256(bytes(name));
        return valid(name) && base.available(uint256(label));
    }

    function register(
        string calldata name,
        address owner,
        address collection,
        uint256 nft,
        address resolver,
        bytes[] calldata data
    ) public {
        if (!nftContracts[collection]) {
            revert InvalidCollection();
        }
        if (valid(nftIds[collection][nft])) {
            revert RegisteredNFT();
        }

        address tokenOwner = ERC721(collection).ownerOf(nft);
        if (tokenOwner != msg.sender) {
            revert UnauthorisedHolder();
        }

        nftIds[collection][nft] = name;

        uint256 tokenId = uint256(keccak256(bytes(name)));
        base.register(tokenId, collection, nft);

        if (data.length > 0) {
            _setRecords(resolver, keccak256(bytes(name)), data);
        }

        emit NameRegistered(
            name,
            keccak256(bytes(name)),
            owner,
            collection,
            nft
        );
    }

    function resetOwner(address collection, uint256 nft) external override {
        string memory name = nftIds[collection][nft];
        uint256 tokenId = uint256(keccak256(bytes(name)));
        require(valid(name), "Token have no name");
        address tokenOwner = ERC721(collection).ownerOf(nft);
        address currentOwner = base.ownerOf(tokenId);
        if (tokenOwner != msg.sender){
            revert UnauthorisedHolder();
        }
        if (currentOwner == address(nameWrapper)) {
            if (nameWrapper.ownerOf(tokenId) != tokenOwner) {
                nameWrapper.resetOwner(tokenId, tokenOwner);
            }
        } else {
            base.resetOwner(tokenId);
        }
    }

    function supportsInterface(
        bytes4 interfaceID
    ) external pure returns (bool) {
        return
            interfaceID == type(IERC165).interfaceId ||
            interfaceID == type(IRemiliasRegistrarController).interfaceId;
    }

    /* Internal functions */

    function _setRecords(
        address resolverAddress,
        bytes32 label,
        bytes[] calldata data
    ) internal {
        // use hardcoded .eth namehash
        bytes32 nodehash = keccak256(abi.encodePacked(REMILIAS_NODE, label));
        Resolver resolver = Resolver(resolverAddress);
        resolver.multicallWithNodeCheck(nodehash, data);
    }

    function _setReverseRecord(
        string memory name,
        address resolver,
        address owner
    ) internal {
        reverseRegistrar.setNameForAddr(
            msg.sender,
            owner,
            resolver,
            string.concat(name, "remilias.eth")
        );
    }
}
